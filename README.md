# Crypto Tracker: A Bitcoin Portfolio Tracker

This application allows you to track your Bitcoin holdings, visualize your portfolio's growth over time, and analyze your investment performance.  It fetches transaction data from your Bitcoin addresses and combines it with historical Bitcoin price data to provide a comprehensive overview of your investments.

## Features

* **Add Bitcoin Addresses:** Easily add your Bitcoin addresses to track your transactions.
* **Transaction History:** View a detailed history of your Bitcoin transactions, including dates, amounts, and values in EUR and USD.
* **Portfolio Value Visualization:** An interactive line chart displays the evolution of your portfolio's value over time, showing both current and historical values.  The chart also displays your cumulative deposits and total sats.
* **Year-over-Year Analysis:** Analyze your investment performance on a yearly basis, viewing total values, deposits, and profit percentages.
* **Summary Statistics:** Quickly access key metrics such as total transactions, total sats, cumulative deposits, and current portfolio value.
* **URL Sharing:** Share your portfolio's performance with others by sharing the URL.


## Technical Details

This project is built using the following technologies:

* **Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide-React, Radix UI
* **Backend:**  The application is frontend-only. It uses the Blockstream API ([https://blockstream.info/api](https://blockstream.info/api)) to fetch transaction data and mempool.space ([https://mempool.space/api/v1/historical-price](https://mempool.space/api/v1/historical-price)) for historical Bitcoin prices.
* **State Management:** React's built-in `useState` hook.
* **Deployment:** Deployed to GitHub Pages using GitHub Actions.


## Setup

1. Clone the repository: `git clone <repository_url>`
2. Navigate to the project directory: `cd crypto-tracker`
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`
5. Build for production: `npm run build`
6. Deploy to GitHub Pages: `npm run deploy`


## Data Sources

* **Transaction Data:** Blockstream API ([https://blockstream.info/api](https://blockstream.info/api))
* **Price Data:** mempool.space ([https://mempool.space/api/v1/historical-price](https://mempool.space/api/v1/historical-price))


## Future Improvements

* **Improved Error Handling:** More robust error handling and user-friendly error messages.
* **Enhanced Data Validation:** More thorough input validation for Bitcoin addresses.
* **Caching:** Implement caching to improve performance, especially for users with many transactions.
* **Testing:** Add unit and integration tests to ensure code quality and reliability.
* **Internationalization:** Support for multiple currencies and languages.
* **Advanced Charting Options:**  Allow users to customize chart views and time ranges.
* **Security:**  Implement measures to protect user privacy and data security.


## Contributing

Contributions are welcome! Please open an issue or submit a pull request.


