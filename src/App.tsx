import React, {useEffect, useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Alert, AlertDescription} from './components/ui/alert';
import {Button} from './components/ui/button';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {ArrowUpDown, Loader2, Plus, Trash2} from 'lucide-react';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Progress} from "@/components/ui/progress";
interface Transaction {
    txid: string;
    timestamp: Date;
    amount: number;
    valueEur: number;
    valueUsd: number;
    currentValueEur: number;
    currentValueUsd: number;
}

interface ChartDataPoint {
    timestamp: string;
    valueEur: number;
    valueUsd: number;
    depositValueEur: number;
    depositValueUsd: number;
    historicalValueEur: number;
    historicalValueUsd: number;
    cumulativeSats: number;
    cumulativeValueEur: number;
    cumulativeValueUsd: number;
    cumulativeDepositValueEur: number;
    cumulativeDepositValueUsd: number;
    cumulativeHistoricalValueEur: number;
    cumulativeHistoricalValueUsd: number;
}

interface YearlyStats {
    year: number;
    totalValue: number;
    totalValueUsd: number;
    deposits: number;
    depositsUsd: number;
    profitEur: string;
    profitUsd: string;
}

interface PriceData {
    EUR: { [timestamp: string]: number };
    USD: { [timestamp: string]: number };
}

interface DailyDataPoint {
    timestamp: string;
    valueEur: number;
    valueUsd: number;
    depositValueEur: number;
    depositValueUsd: number;
    historicalValueEur: number;
    historicalValueUsd: number;
    cumulativeValueEur: number;
    cumulativeValueUsd: number;
    cumulativeDepositValueEur: number;
    cumulativeDepositValueUsd: number;
    cumulativeHistoricalValueEur: number;
    cumulativeHistoricalValueUsd: number;
    cumulativeSats: number;
}
const API_ENDPOINTS = {
    BLOCKSTREAM: 'https://blockstream.info/api',
    COINGECKO: 'https://api.coingecko.com/api/v3'
};
const CryptoTracker = () => {
    const [addresses, setAddresses] = useState([]);
    const [newAddress, setNewAddress] = useState('');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [yearlyData, setYearlyData] = useState<YearlyStats[]>([]);
    const [priceData, setPriceData] = useState({});
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState({key: 'timestamp', direction: 'desc'});
    const [filterYear, setFilterYear] = useState('all');
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState('');
// Add a new state at the top of your component to track visible lines
    const [visibleLines, setVisibleLines] = useState({
        portfolioEUR: true,
        portfolioUSD: true,
        depositEUR: true,
        depositUSD: true,
        sats: true
    });

    const handleLegendClick = (entry) => {
        const lineKey = {
            "Portfolio Value (EUR)": "portfolioEUR",
            "Portfolio Value (USD)": "portfolioUSD",
            "Deposit Value (EUR)": "depositEUR",
            "Deposit Value (USD)": "depositUSD",
            "Cumulative Sats": "sats"
        }[entry.value];

        if (lineKey) {
            setVisibleLines(prev => {
                // Check if this is the last visible line
                const visibleCount = Object.values(prev).filter(Boolean).length;
                if (visibleCount === 1 && prev[lineKey]) {
                    return prev; // Don't allow hiding the last visible line
                }
                return {
                    ...prev,
                    [lineKey]: !prev[lineKey]
                };
            });
        }
    };

// Enhanced legend style
    const legendStyle = {
        cursor: 'pointer',
        '.recharts-legend-item': {
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            '&:hover': {
                opacity: 0.7
            }
        },
        '.recharts-legend-item.inactive': {
            opacity: 0.3
        }
    };


    // URL parameter handling
    const updateUrlParams = (addrs) => {
        const url = new URL(window.location.toString());
        if (addrs.length > 0) {
            url.searchParams.set('addresses', addrs.join(','));
        } else {
            url.searchParams.delete('addresses');
        }
        window.history.pushState({}, '', url);
    };

    // Load addresses from URL on mount
    useEffect(() => {
        const url = new URL(window.location.toString());

        const addressParam = url.searchParams.get('addresses');
        if (addressParam) {
            const initialAddresses = addressParam.split(',').filter(addr => addr.trim());
            setAddresses(initialAddresses);
            console.log('Loaded addresses from URL:', initialAddresses);
        }
    }, []);

    // Update URL when addresses change
    useEffect(() => {
        updateUrlParams(addresses);
    }, [addresses]);

    const handleAddAddress = () => {
        if (!newAddress.trim()) {
            setError('Please enter a valid Bitcoin address');
            return;
        }

        if (addresses.includes(newAddress)) {
            setError('Address already added');
            return;
        }

        setAddresses([...addresses, newAddress]);
        setNewAddress('');
        setError('');
    };

    const handleRemoveAddress = (address) => {
        setAddresses(addresses.filter(a => a !== address));
    };

    // Handle browser back/forward
    useEffect(() => {
        const handlePopState = () => {
            const url = new URL(window.location.toString());

            const addressParam = url.searchParams.get('addresses');
            if (addressParam) {
                setAddresses(addressParam.split(',').filter(addr => addr.trim()));
            } else {
                setAddresses([]);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Share button handler
    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Bitcoin Holdings Tracker',
                url: window.location.href
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(window.location.href)
                .then(() => alert('URL copied to clipboard!'))
                .catch(console.error);
        }
    };
    const fetchPriceData = async (timestamps) => {
        try {
            const [eurResponse, usdResponse] = await Promise.all([
                fetch('https://mempool.space/api/v1/historical-price?currency=EUR'),
                fetch('https://mempool.space/api/v1/historical-price?currency=USD')
            ]);

            if (!eurResponse.ok || !usdResponse.ok)
                throw new Error('Failed to fetch price data');

            const eurData = await eurResponse.json();
            const usdData = await usdResponse.json();

            console.log('Raw EUR data:', eurData);
            console.log('Raw USD data:', usdData);

            // Create price maps for both currencies
            const priceMap = {
                EUR: {},
                USD: {}
            };

            // Process EUR prices
            eurData.prices.forEach(dataPoint => {
                priceMap.EUR[dataPoint.time] = dataPoint.EUR;
            });

            // Process USD prices
            usdData.prices.forEach(dataPoint => {
                priceMap.USD[dataPoint.time] = dataPoint.USD;
            });

            // Debug logging
            const timestamps = Object.keys(priceMap.EUR).map(Number);
            console.log('Processed price timestamps:', {
                first: new Date(timestamps[0] * 1000),
                last: new Date(timestamps[timestamps.length - 1] * 1000),
                count: timestamps.length,
                sampleEUR: priceMap.EUR[timestamps[0]],
                sampleUSD: priceMap.USD[timestamps[0]]
            });

            return priceMap;
        } catch (error) {
            console.error('Price fetch error:', error);
            throw new Error(`Error fetching prices: ${error.message}`);
        }
    };
    // Calculate transaction amount (simplified version)
    const calculateTxAmount = (tx, address) => {
        let amount = 0;
        // Sum inputs where address is sender
        tx.vin.forEach(input => {
            if (input.prevout.scriptpubkey_address === address) {
                amount -= input.prevout.value;
            }
        });
        // Sum outputs where address is receiver
        tx.vout.forEach(output => {
            if (output.scriptpubkey_address === address) {
                amount += output.value;
            }
        });
        return amount;
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const processTransactions = async () => {
        setLoading(true);
        setError('');
        try {
            const allTxs = await Promise.all(
                addresses.map(address => fetchTransactions(address))
            );
            const flatTxs = allTxs.flat();

            // Debug timestamp from transaction
            console.log('Transaction timestamp example:', {
                original: flatTxs[0]?.timestamp,
                inSeconds: Math.floor(flatTxs[0]?.timestamp.getTime() / 1000)
            });

            const timestamps = flatTxs.map(tx => Math.floor(tx.timestamp.getTime() / 1000));
            const prices = await fetchPriceData(timestamps);
            const priceTimestamps = Object.keys(prices).map(Number);

            console.log('Available price timestamps:', {
                first: new Date(priceTimestamps[0] * 1000),
                last: new Date(priceTimestamps[priceTimestamps.length - 1] * 1000),
                count: priceTimestamps.length
            });


// Modify the processTransactions function to include USD values
            // Update the fetchPriceData function to properly handle timestamps


// Update the price matching logic in processTransactions
            const processedTxs = flatTxs.map(tx => {
                const txTimestampSeconds = Math.floor(tx.timestamp.getTime() / 1000);

                // Get all available timestamps
                const timestamps = Object.keys(prices.EUR).map(Number);

                // Find closest timestamp for transaction price
                const closestPastTimestamp = timestamps
                    .filter(t => t <= txTimestampSeconds)
                    .reduce((a, b) => Math.abs(b - txTimestampSeconds) < Math.abs(a - txTimestampSeconds) ? b : a,
                        timestamps[0]);

                const latestTimestamp = Math.max(...timestamps);

                // Debug logging
                console.log('Price matching:', {
                    txTime: new Date(txTimestampSeconds * 1000),
                    closestTime: new Date(closestPastTimestamp * 1000),
                    eurPrice: prices.EUR[closestPastTimestamp],
                    usdPrice: prices.USD[closestPastTimestamp]
                });

                return {
                    ...tx,
                    valueEur: (tx.amount * prices.EUR[closestPastTimestamp]) / 100000000,
                    valueUsd: (tx.amount * prices.USD[closestPastTimestamp]) / 100000000,
                    currentValueEur: (tx.amount * prices.EUR[latestTimestamp]) / 100000000,
                    currentValueUsd: (tx.amount * prices.USD[latestTimestamp]) / 100000000,
                };
            });
            setTransactions(processedTxs);
            setPriceData(prices);
            updateChartData(processedTxs, prices);
            updateYearlyData(processedTxs);
        } catch (error) {
            console.error('Processing error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async (address) => {
        try {
            let allTransactions = [];
            let lastTxId = null;
            let pageCount = 0;
            const MAX_PAGES = 100;
            const PAGE_SIZE = 25;
            const RATE_LIMIT_DELAY = 1100;

            // First, get the first page to estimate total transactions
            const initialResponse = await fetch(`${API_ENDPOINTS.BLOCKSTREAM}/address/${address}/txs`);
            if (!initialResponse.ok) {
                throw new Error(`Failed to fetch transactions: ${initialResponse.status}`);
            }
            const firstPage = await initialResponse.json();
            const estimatedTotal = firstPage.length === PAGE_SIZE ? 'multiple pages' : firstPage.length;

            setLoadingStatus(`Fetching transactions for ${address} (estimated: ${estimatedTotal})`);

            while (pageCount < MAX_PAGES) {
                if (pageCount > 0) {
                    await sleep(RATE_LIMIT_DELAY);
                }

                let url = `${API_ENDPOINTS.BLOCKSTREAM}/address/${address}/txs`;
                if (lastTxId) {
                    url = `${API_ENDPOINTS.BLOCKSTREAM}/address/${address}/txs/chain/${lastTxId}`;
                }

                try {
                    const response = await fetch(url);

                    if (response.status === 429) {
                        setLoadingStatus('Rate limit reached, waiting...');
                        await sleep(5000);
                        continue;
                    }

                    if (!response.ok) {
                        throw new Error(`Failed to fetch transactions: ${response.status}`);
                    }

                    const transactions = await response.json();

                    if (!transactions || transactions.length === 0) {
                        break;
                    }

                    allTransactions = [...allTransactions, ...transactions];

                    // Update progress
                    setLoadingProgress(prev => Math.min(prev + (100 / (estimatedTotal === 'multiple pages' ? 100 : estimatedTotal)), 99));
                    setLoadingStatus(`Fetched ${allTransactions.length} transactions for ${address}`);

                    if (transactions.length < PAGE_SIZE) {
                        break;
                    }

                    lastTxId = transactions[transactions.length - 1].txid;
                    pageCount++;
                } catch (error) {
                    if (error.message.includes('429')) {
                        setLoadingStatus('Rate limit error, retrying...');
                        await sleep(5000);
                        continue;
                    }
                    throw error;
                }
            }

            // Process transactions...
            setLoadingStatus('Processing transactions...');
            const processedTxs = allTransactions
                .map(tx => {
                    if (!tx.status?.block_time) return null;
                    const timestamp = new Date(tx.status.block_time * 1000);
                    if (isNaN(timestamp.getTime())) return null;
                    return {
                        txid: tx.txid,
                        timestamp,
                        amount: calculateTxAmount(tx, address),
                    };
                })
                .filter(tx => tx !== null);

            setLoadingProgress(100);
            return processedTxs;
        } catch (error) {
            console.error('Detailed error information:', {
                address,
                errorType: error.constructor.name,
                errorMessage: error.message,
                errorStack: error.stack
            });
            throw error;
        }
    };




// The typed function
    const updateChartData = (txs: Transaction[], prices: PriceData): void => {
        const dailyData: { [date: string]: DailyDataPoint } = {};
        let cumulativeSats = 0;

        // Sort transactions by date
        const sortedTxs = [...txs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Get latest prices
        const timestamps = Object.keys(prices.EUR).map(Number);
        const latestTimestamp = Math.max(...timestamps);
        const currentEurPrice = prices.EUR[latestTimestamp];
        const currentUsdPrice = prices.USD[latestTimestamp];

        sortedTxs.forEach(tx => {
            const date = tx.timestamp.toISOString().split('T')[0];
            const txTimestampSeconds = Math.floor(tx.timestamp.getTime() / 1000);

            // Find closest historical price
            const closestPriceTimestamp = timestamps
                .filter(t => t <= txTimestampSeconds)
                .reduce((a, b) => Math.abs(b - txTimestampSeconds) < Math.abs(a - txTimestampSeconds) ? b : a);

            cumulativeSats += tx.amount;

            if (!dailyData[date]) {
                dailyData[date] = {
                    timestamp: date,
                    valueEur: 0,
                    valueUsd: 0,
                    depositValueEur: 0,
                    depositValueUsd: 0,
                    historicalValueEur: 0,
                    historicalValueUsd: 0,
                    cumulativeValueEur: 0,
                    cumulativeValueUsd: 0,
                    cumulativeDepositValueEur: 0,
                    cumulativeDepositValueUsd: 0,
                    cumulativeHistoricalValueEur: 0,
                    cumulativeHistoricalValueUsd: 0,
                    cumulativeSats: 0,
                };
            }

            const historicalEurPrice = prices.EUR[closestPriceTimestamp];
            const historicalUsdPrice = prices.USD[closestPriceTimestamp];

            dailyData[date].valueEur += tx.currentValueEur;
            dailyData[date].valueUsd += tx.currentValueUsd;
            dailyData[date].depositValueEur += tx.valueEur;
            dailyData[date].depositValueUsd += tx.valueUsd;
            dailyData[date].historicalValueEur = (cumulativeSats * historicalEurPrice) / 100000000;
            dailyData[date].historicalValueUsd = (cumulativeSats * historicalUsdPrice) / 100000000;
            dailyData[date].cumulativeSats = cumulativeSats;
        });

        // Calculate cumulative values
        let runningDepositEur = 0;
        let runningDepositUsd = 0;
        let runningCurrentEur = 0;
        let runningCurrentUsd = 0;

        const chartData = Object.values(dailyData)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map(day => {
                runningDepositEur += day.depositValueEur;
                runningDepositUsd += day.depositValueUsd;
                runningCurrentEur += day.valueEur;
                runningCurrentUsd += day.valueUsd;
                return {
                    ...day,
                    cumulativeValueEur: runningCurrentEur,
                    cumulativeValueUsd: runningCurrentUsd,
                    cumulativeDepositValueEur: runningDepositEur,
                    cumulativeDepositValueUsd: runningDepositUsd,
                    cumulativeHistoricalValueEur: day.historicalValueEur,
                    cumulativeHistoricalValueUsd: day.historicalValueUsd
                };
            });

        // Add current date point if needed
        if (chartData.length > 0) {
            const lastEntry = chartData[chartData.length - 1];
            const today = new Date().toISOString().split('T')[0];

            if (today !== lastEntry.timestamp) {
                chartData.push({
                    ...lastEntry,
                    timestamp: today,
                    valueEur: 0,
                    valueUsd: 0,
                    depositValueEur: 0,
                    depositValueUsd: 0,
                    historicalValueEur: (lastEntry.cumulativeSats * currentEurPrice) / 100000000,
                    historicalValueUsd: (lastEntry.cumulativeSats * currentUsdPrice) / 100000000,
                    cumulativeHistoricalValueEur: (lastEntry.cumulativeSats * currentEurPrice) / 100000000,
                    cumulativeHistoricalValueUsd: (lastEntry.cumulativeSats * currentUsdPrice) / 100000000,
                    cumulativeDepositValueEur: lastEntry.cumulativeDepositValueEur,
                    cumulativeDepositValueUsd: lastEntry.cumulativeDepositValueUsd,
                });
            }
        }

        setChartData(chartData);
    };

// Update yearly summary data
    const updateYearlyData = (txs: Transaction[]) => {
        const yearlyStats: {
            [key: number]: {
                year: number;
                totalValue: number;
                totalValueUsd: number;
                deposits: number;
                depositsUsd: number;
            }
        } = {};

        // Process all transactions
        txs.forEach(tx => {
            const year = tx.timestamp.getFullYear();

            if (!yearlyStats[year]) {
                yearlyStats[year] = {
                    year,
                    totalValue: 0,
                    totalValueUsd: 0,
                    deposits: 0,
                    depositsUsd: 0
                };
            }

            // Add current values
            yearlyStats[year].totalValue += tx.currentValueEur;
            yearlyStats[year].totalValueUsd += tx.currentValueUsd;

            // Add deposit values
            yearlyStats[year].deposits += tx.valueEur;
            yearlyStats[year].depositsUsd += tx.valueUsd;
        });

        // Convert to array and calculate profit percentages
        const yearlyData: YearlyStats[] = Object.values(yearlyStats)
            .map(stat => ({
                ...stat,
                profitEur: stat.deposits > 0
                    ? ((stat.totalValue - stat.deposits) / stat.deposits * 100).toFixed(2)
                    : '0.00',
                profitUsd: stat.depositsUsd > 0
                    ? ((stat.totalValueUsd - stat.depositsUsd) / stat.depositsUsd * 100).toFixed(2)
                    : '0.00'
            }))
            .sort((a, b) => b.year - a.year); // Sort by year descending

        setYearlyData(yearlyData);
    };

    // Sort handler for tables
    const handleSort = (key) => {
        setSortConfig({
            key,
            direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
        });
    };

    // Calculate totals
    interface ProfitLoss {
        totalDepositsEur: number;
        totalDepositsUsd: number;
        currentValueEur: number;
        currentValueUsd: number;
        profitPercentageEur: number;
        profitPercentageUsd: number;
    }

    const calculateProfitLoss = (): ProfitLoss => {
        const totalDepositsEur = transactions.reduce((sum, tx) => sum + tx.valueEur, 0);
        const totalDepositsUsd = transactions.reduce((sum, tx) => sum + tx.valueUsd, 0);
        const currentValueEur = transactions.reduce((sum, tx) => sum + tx.currentValueEur, 0);
        const currentValueUsd = transactions.reduce((sum, tx) => sum + tx.currentValueUsd, 0);
        const profitPercentageEur = totalDepositsEur ? ((currentValueEur - totalDepositsEur) / totalDepositsEur * 100) : 0;
        const profitPercentageUsd = totalDepositsUsd ? ((currentValueUsd - totalDepositsUsd) / totalDepositsUsd * 100) : 0;

        return {
            totalDepositsEur,
            totalDepositsUsd,
            currentValueEur,
            currentValueUsd,
            profitPercentageEur,
            profitPercentageUsd
        };
    };
    // Effect to process transactions when addresses change
    useEffect(() => {
        if (addresses.length > 0) {
            processTransactions();
        }
    }, [addresses]);

    

    // Sort and filter transactions for display
    const getSortedTransactions = () => {
        const filtered = filterYear === 'all'
            ? transactions
            : transactions.filter(tx => tx.timestamp.getFullYear().toString() === filterYear);

        return filtered.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            if (sortConfig.direction === 'asc') {
                return aValue > bValue ? 1 : -1;
            }
            return aValue < bValue ? 1 : -1;
        });
    };
    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Bitcoin Holdings Tracker</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Track your Bitcoin journey by adding your addresses. See how your holdings have grown over time,
                            analyze your historical returns, and view your complete transaction history. The chart shows your
                            total portfolio value at each point in time (blue), your cumulative deposits (gray), and your
                            total Bitcoin amount in sats (green).
                        </p>
                        {addresses.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleShare}
                            >
                                Share
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Address Input Section */}
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                value={newAddress}
                                onChange={(e) => setNewAddress(e.target.value)}
                                placeholder="Enter Bitcoin address"
                                className="flex-1"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddAddress();
                                    }
                                }}
                            />
                            <Button onClick={handleAddAddress} disabled={loading}>
                                <Plus className="w-4 h-4 mr-2"/>
                                Add Address
                            </Button>
                        </div>

                        {/* Address List with better styling */}
                        <div className="space-y-2">
                            {addresses.map((address) => (
                                <div
                                    key={address}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <span className="font-mono text-sm break-all">{address}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveAddress(address)}
                                        disabled={loading}
                                        className="ml-2 text-gray-500 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4"/>
                                    </Button>
                                </div>
                            ))}
                        </div>
                        {loading && (
                            <div className="space-y-2 my-4">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin"/>
                                    <span className="text-sm text-gray-500">{loadingStatus}</span>
                                </div>
                                <Progress value={loadingProgress}/>
                            </div>
                        )}

                        {/* Error Display */}
                        {error && (
                            <Alert variant="destructive" className="my-4">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        {/* Summary Statistics */}
                        {/* Update the summary cards section */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-2xl font-bold text-center">
                                        {transactions.length.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-500 text-center">Total Transactions</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-xl font-bold text-center break-all">
                                        {(transactions.reduce((sum, tx) => sum + tx.amount, 0)).toLocaleString()}
                                        <span className="text-base ml-1">sats</span>
                                    </div>
                                    <div className="text-sm text-gray-500 text-center">Total Sats</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-xl font-bold text-center break-all">
                                        €{(transactions.reduce((sum, tx) => sum + tx.valueEur, 0))
                                        .toLocaleString(undefined, {maximumFractionDigits: 0})}
                                        <br />
                                        ${(transactions.reduce((sum, tx) => sum + tx.valueUsd, 0))
                                        .toLocaleString(undefined, {maximumFractionDigits: 0})}
                                    </div>
                                    <div className="text-sm text-gray-500 text-center">Cumulative Deposit Value</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-xl font-bold text-center break-all">
                                        €{(transactions.reduce((sum, tx) => sum + tx.currentValueEur, 0))
                                        .toLocaleString(undefined, {maximumFractionDigits: 0})}
                                        <br />
                                        ${(transactions.reduce((sum, tx) => sum + tx.currentValueUsd, 0))
                                        .toLocaleString(undefined, {maximumFractionDigits: 0})}
                                    </div>
                                    <div className="text-sm text-gray-500 text-center">Cumulative Current Value</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-2xl font-bold text-center">
                                        {((transactions.reduce((sum, tx) => sum + tx.currentValueEur, 0) /
                                            transactions.reduce((sum, tx) => sum + tx.valueEur, 0) - 1) * 100).toFixed(2)}%
                                        <br/>
                                        {((transactions.reduce((sum, tx) => sum + tx.currentValueUsd, 0) /
                                            transactions.reduce((sum, tx) => sum + tx.valueUsd, 0) - 1) * 100).toFixed(2)}%
                                    </div>
                                    <div className="text-sm text-gray-500 text-center">Total Return (EUR/USD)</div>
                                </CardContent>
                            </Card>
                        </div>
                        {/* Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Value Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis dataKey="timestamp"/>
                                            <YAxis
                                                yAxisId="left"
                                                label={{value: 'EUR / USD', angle: -90, position: 'insideLeft'}}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                label={{value: 'Sats', angle: 90, position: 'insideRight'}}
                                            />
                                            <Tooltip
                                                formatter={(value: number, name: string) => {
                                                    if (name === "Cumulative Sats") {
                                                        return `${value.toLocaleString()} sats`;
                                                    }
                                                    return `${String(name).includes('USD') ? '$' : '€'}${value.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
                                                }}
                                            />
                                            <Legend
                                                onClick={handleLegendClick}
                                                formatter={(value, entry) => {
                                                    const opacity = visibleLines[{
                                                        "Portfolio Value (EUR)": "portfolioEUR",
                                                        "Portfolio Value (USD)": "portfolioUSD",
                                                        "Deposit Value (EUR)": "depositEUR",
                                                        "Deposit Value (USD)": "depositUSD",
                                                        "Cumulative Sats": "sats"
                                                    }[value]] ? 1 : 0.3;

                                                    return <span style={{ color: entry.color, opacity }}>{value}</span>;
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeHistoricalValueEur"
                                                stroke="#2563eb"
                                                name="Portfolio Value (EUR)"
                                                yAxisId="left"
                                                hide={!visibleLines.portfolioEUR}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeHistoricalValueUsd"
                                                stroke="#3b82f6"
                                                name="Portfolio Value (USD)"
                                                yAxisId="left"
                                                strokeDasharray="5 5"
                                                hide={!visibleLines.portfolioUSD}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeDepositValueEur"
                                                stroke="#64748b"
                                                name="Deposit Value (EUR)"
                                                yAxisId="left"
                                                hide={!visibleLines.depositEUR}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeDepositValueUsd"
                                                stroke="#94a3b8"
                                                name="Deposit Value (USD)"
                                                yAxisId="left"
                                                strokeDasharray="5 5"
                                                hide={!visibleLines.depositUSD}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeSats"
                                                stroke="#059669"
                                                name="Cumulative Sats"
                                                yAxisId="right"
                                                hide={!visibleLines.sats}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Year-over-Year Analysis</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-4">
                                                <Button variant="ghost" onClick={() => handleSort('year')}>
                                                    Year <ArrowUpDown className="w-4 h-4 ml-1"/>
                                                </Button>
                                            </th>
                                            <th className="text-left p-4">Total Value (EUR/USD)</th>
                                            <th className="text-left p-4">Deposits (EUR/USD)</th>
                                            <th className="text-left p-4">Profit %</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {yearlyData.map((year) => (
                                            <tr key={year.year} className="border-b hover:bg-gray-50">
                                                <td className="p-4">{year.year}</td>
                                                <td className="p-4">
                                                    €{year.totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                    <br/>
                                                    ${year.totalValueUsd.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                </td>
                                                <td className="p-4">
                                                    €{year.deposits.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                    <br/>
                                                    ${year.depositsUsd.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                </td>
                                                <td className="p-4">
                                                    {year.profitEur}% (EUR)
                                                    <br/>
                                                    {year.profitUsd}% (USD)
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Transaction History */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Transaction History</CardTitle>
                                <div className="flex items-center gap-4">
                                    <Select value={filterYear} onValueChange={setFilterYear}>
                                        <SelectTrigger className="w-32">
                                            <SelectValue placeholder="Filter by year"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Years</SelectItem>
                                            {[...new Set(transactions.map(tx => tx.timestamp.getFullYear()))].sort().map(year => (
                                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-4">
                                                <Button variant="ghost" onClick={() => handleSort('timestamp')}>
                                                    Date <ArrowUpDown className="w-4 h-4 ml-1"/>
                                                </Button>
                                            </th>
                                            <th className="text-left p-4">Transaction ID</th>
                                            <th className="text-left p-4">Amount (sats)</th>
                                            <th className="text-left p-4">Value at Transaction (EUR / USD)</th>
                                            <th className="text-left p-4">Current Value (EUR / USD)</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {getSortedTransactions().map((tx) => (
                                            <tr key={tx.txid} className="border-b hover:bg-gray-50">
                                                <td className="p-4">{tx.timestamp.toLocaleDateString()}</td>
                                                <td className="p-4 font-mono text-xs">{tx.txid}</td>
                                                <td className="p-4">{tx.amount.toLocaleString()}</td>
                                                <td className="p-4">
                                                    €{tx.valueEur.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                    <br/>
                                                    ${tx.valueUsd.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                </td>
                                                <td className="p-4">
                                                    €{tx.currentValueEur.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                    <br/>
                                                    ${tx.currentValueUsd.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
export default CryptoTracker;