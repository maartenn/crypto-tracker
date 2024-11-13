import React, {useEffect, useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import { Alert, AlertDescription } from './components/ui/alert';
import { Button } from './components/ui/button';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {ArrowUpDown, Plus, Trash2} from 'lucide-react';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from 'lucide-react';

const API_ENDPOINTS = {
    BLOCKSTREAM: 'https://blockstream.info/api',
    COINGECKO: 'https://api.coingecko.com/api/v3'
};
const CryptoTracker = () => {
    const [addresses, setAddresses] = useState([]);
    const [newAddress, setNewAddress] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [priceData, setPriceData] = useState({});
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [yearlyData, setYearlyData] = useState([]);
    const [sortConfig, setSortConfig] = useState({key: 'timestamp', direction: 'desc'});
    const [filterYear, setFilterYear] = useState('all');
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState('');

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
    const fetchPriceData = async (timestamps) => {
        try {
            const response = await fetch('https://mempool.space/api/v1/historical-price?currency=EUR');
            if (!response.ok) throw new Error('Failed to fetch price data');
            const data = await response.json();

            // Debug the actual data structure
            console.log('Raw Mempool response:', data);

            // The prices are in an array with timestamps
            const priceMap = data.prices.reduce((acc, price) => {
                // Each price object should have a timestamp and EUR value
                acc[price.time] = price.EUR;
                return acc;
            }, {});

            // Debug the processed price map
            console.log('Processed price map:', {
                firstEntry: Object.entries(priceMap)[0],
                lastEntry: Object.entries(priceMap)[Object.entries(priceMap).length - 1],
                totalEntries: Object.keys(priceMap).length
            });

            return priceMap;
        } catch (error) {
            console.error('Price fetch error:', error);
            throw new Error(`Error fetching price data: ${error.message}`);
        }
    };
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


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

            const processedTxs = flatTxs.map(tx => {
                const txTimestampSeconds = Math.floor(tx.timestamp.getTime() / 1000);

                // Find closest timestamp for transaction price
                const closestPastTimestamp = priceTimestamps
                    .filter(t => t <= txTimestampSeconds)
                    .reduce((a, b) => Math.abs(b - txTimestampSeconds) < Math.abs(a - txTimestampSeconds) ? b : a,
                        priceTimestamps[0]);

                const latestTimestamp = Math.max(...priceTimestamps);

                console.log('Price matching for tx:', {
                    txTime: new Date(txTimestampSeconds * 1000),
                    closestPriceTime: new Date(closestPastTimestamp * 1000),
                    priceAtTx: prices[closestPastTimestamp],
                    currentPrice: prices[latestTimestamp]
                });

                return {
                    ...tx,
                    valueEur: (tx.amount * prices[closestPastTimestamp]) / 100000000,
                    currentValueEur: (tx.amount * prices[latestTimestamp]) / 100000000,
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

    const updateChartData = (txs, prices) => {
        const dailyData = {};
        let cumulativeSats = 0;

        // Sort transactions by date first
        const sortedTxs = [...txs].sort((a, b) => a.timestamp - b.timestamp);

        sortedTxs.forEach(tx => {
            const date = tx.timestamp.toISOString().split('T')[0];
            cumulativeSats += tx.amount;

            if (!dailyData[date]) {
                dailyData[date] = {
                    timestamp: date,
                    valueEur: 0,
                    depositValueEur: 0,
                    cumulativeValueEur: 0,
                    cumulativeDepositValueEur: 0,
                    cumulativeSats: 0,
                };
            }
            dailyData[date].valueEur += tx.currentValueEur;
            dailyData[date].depositValueEur += tx.valueEur;
            dailyData[date].cumulativeSats = cumulativeSats;
        });

        // Calculate cumulative values
        let runningDepositSum = 0;
        let runningCurrentSum = 0;

        const chartData = Object.values(dailyData)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .map(day => {
                runningDepositSum += day.depositValueEur;
                runningCurrentSum += day.valueEur;
                return {
                    ...day,
                    cumulativeValueEur: runningCurrentSum,
                    cumulativeDepositValueEur: runningDepositSum
                };
            });

        console.log('Chart data with cumulative values:', {
            firstDate: chartData[0]?.timestamp,
            lastDate: chartData[chartData.length - 1]?.timestamp,
            totalPoints: chartData.length,
            finalCumulativeValue: chartData[chartData.length - 1]?.cumulativeValueEur
        });

        setChartData(chartData);
    };

// Update yearly summary data
    const updateYearlyData = (txs) => {
        const yearlyStats = {};
        txs.forEach(tx => {
            const year = tx.timestamp.getFullYear();
            if (!yearlyStats[year]) {
                yearlyStats[year] = {
                    year,
                    totalValue: 0,
                    deposits: 0,
                };
            }
            yearlyStats[year].totalValue += tx.currentValueEur;
            yearlyStats[year].deposits += tx.valueEur;
        });

        // Calculate profit
        const yearlyData = Object.values(yearlyStats).map(stat => ({
            ...stat,
            profit: stat.deposits > 0
                ? ((stat.totalValue - stat.deposits) / stat.deposits * 100).toFixed(2)
                : '0.00'
        }));

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
    const calculateProfitLoss = () => {
        const totalDeposits = transactions.reduce((sum, tx) => sum + tx.valueEur, 0);
        const currentValue = transactions.reduce((sum, tx) => sum + tx.currentValueEur, 0);
        const profitPercentage = totalDeposits ? ((currentValue - totalDeposits) / totalDeposits * 100) : 0;
        return {totalDeposits, currentValue, profitPercentage};
    };

    // Effect to process transactions when addresses change
    useEffect(() => {
        if (addresses.length > 0) {
            processTransactions();
        }
    }, [addresses]);

    const {totalDeposits, currentValue, profitPercentage} = calculateProfitLoss();

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
                    {/* Rest of your existing JSX */}
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
                                    </div>
                                    <div className="text-sm text-gray-500 text-center">Cumulative Deposit Value</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-xl font-bold text-center break-all">
                                        €{(transactions.reduce((sum, tx) => sum + tx.currentValueEur, 0))
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
                                    </div>
                                    <div className="text-sm text-gray-500 text-center">Total Return</div>
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
                                                label={{value: 'EUR', angle: -90, position: 'insideLeft'}}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                label={{value: 'Sats', angle: 90, position: 'insideRight'}}
                                            />
                                            <Tooltip
                                                formatter={(value, name) => {
                                                    if (name === "Cumulative Sats") {
                                                        return `${value.toLocaleString()} sats`;
                                                    }
                                                    return `€${value.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
                                                }}
                                            />
                                            <Legend/>
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeValueEur"
                                                stroke="#2563eb"
                                                name="Cumulative Current Value"
                                                yAxisId="left"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeDepositValueEur"
                                                stroke="#64748b"
                                                name="Cumulative Deposit Value"
                                                yAxisId="left"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulativeSats"
                                                stroke="#059669"
                                                name="Cumulative Sats"
                                                yAxisId="right"
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
                                            <th className="text-left p-4">Total Value (EUR)</th>
                                            <th className="text-left p-4">Deposits (EUR)</th>
                                            <th className="text-left p-4">Profit %</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {yearlyData.map((year) => (
                                            <tr key={year.year} className="border-b hover:bg-gray-50">
                                                <td className="p-4">{year.year}</td>
                                                <td className="p-4">€{year.totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                                <td className="p-4">€{year.deposits.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                                <td className="p-4">{year.profit}%</td>
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
                                            <th className="text-left p-4">Value at Transaction (EUR)</th>
                                            <th className="text-left p-4">Current Value (EUR)</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {getSortedTransactions().map((tx) => (
                                            <tr key={tx.txid} className="border-b hover:bg-gray-50">
                                                <td className="p-4">{tx.timestamp.toLocaleDateString()}</td>
                                                <td className="p-4 font-mono text-xs">{tx.txid}</td>
                                                <td className="p-4">{tx.amount.toLocaleString()}</td>
                                                <td className="p-4">€{tx.valueEur.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                                <td className="p-4">€{tx.currentValueEur.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
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