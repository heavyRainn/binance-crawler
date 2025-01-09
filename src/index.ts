import BigNumber from 'bignumber.js';

/**
 * Интерфейс, описывающий тикер, получаемый от Binance.
 * Здесь поле price представлено BigNumber для точных вычислений.
 */
interface Ticker {
    /**
     * Торговая пара (например, 'BTCUSDT').
     */
    symbol: string;

    /**
     * Текущая цена пары (BigNumber для точной арифметики).
     */
    price: BigNumber;
}

/**
 * Интерфейс, описывающий символ (пару), приходящий в /exchangeInfo.
 */
interface ExchangeSymbol {
    /**
     * Название символа (например, 'BTCUSDT').
     */
    symbol: string;

    /**
     * Текущее состояние символа (например, 'TRADING' или 'BREAK').
     */
    status: string;

    // При необходимости можно добавить другие поля (baseAsset, quoteAsset и т.д.)
}

/**
 * Запускает основной процесс:
 * 1. Получает из Binance список символов со статусом "TRADING".
 * 2. Запрашивает актуальные цены у /api/v3/ticker/price, фильтрует по торговым символам.
 * 3. Выводит все тикеры в консоль, а также:
 *    - Топ-5 пар с минимальной ценой.
 *    - Топ-5 пар с максимальной ценой.
 *    - Среднюю цену по всем полученным тикерам.
 *
 * В случае ошибки выводит сообщение об ошибке в консоль.
 *
 * @returns Promise<void>
 */
async function main(): Promise<void> {
    try {
        // Получение Set символов, доступных для торгов (status === 'TRADING')
        const tradingSymbols = await getTradingSymbols();

        // Получение тикеров (symbol, price), доступных для торговли
        const tickers: Ticker[] = await getTickers(tradingSymbols);

        console.log('--- All Tickers from Binance ---');

        // Вывод символа и цены в виде строки
        tickers.forEach((ticker) => {
            console.log(`Symbol: ${ticker.symbol}, Price: ${ticker.price.toString()}`);
        });

        console.log('-------------------------------------');
        console.log(`Total tickers (excluding zero-price): ${tickers.length}`);

        const lowest5 = toReadable(tickers.slice(0, 5));
        console.log('--- Top 5 lowest price ---', lowest5);

        const highest5 = toReadable(tickers.slice(-5));
        console.log('--- Top 5 highest  price---', highest5);

        // Суммируем цены всех тикеров для нахождения среднего арифметического
        const priceSum = tickers.reduce((acc, item) => acc.plus(item.price), new BigNumber(0));
        const averagePrice = priceSum.dividedBy(tickers.length).toString();
        console.log('--- Average price---', averagePrice);
    } catch (err) {
        if (err instanceof Error) {
            // Обрабатываем возможную ошибку
            console.error('Error:', err.message);
        } else {
            console.error('Unknown error:', err);
        }
    }
}

/**
 * Получает список цен по всем символам (парам), предоставляемым эндпоинтом /api/v3/ticker/price,
 * фильтрует их по заданному множеству «торговых» символов, а затем возвращает отсортированный массив Ticker.
 *
 * @param tradingSymbols - Множество (Set) строк, каждая из которых — название символа, доступного для торгов.
 * @returns Массив объектов Ticker (symbol + price в BigNumber), отсортированный по возрастанию цены.
 * @throws Если ответ от Binance не успешен (status не OK).
 */
async function getTickers(tradingSymbols: Set<any>) {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price');
    if (!response.ok) {
        throw new Error(`Error while requesting Binance: ${response.status} ${response.statusText}`);
    }

    /**
     * Тип данных, которые приходят от Binance:
     * { symbol: string; price: string; } (строка в поле price).
     */
    const rawData: Array<{ symbol: string; price: string }> = await response.json();

    // Формируем список (массив) тикеров, где price парсится в BigNumber, затем сортируем по цене (возрастание).
    return rawData
        .map<Ticker>((item) => ({symbol: item.symbol, price: new BigNumber(item.price),}))
        .filter((item) => tradingSymbols.has(item.symbol))
        .sort((a, b) => a.price.comparedTo(b.price));
}

/**
 * Получает с Binance список всех символов (пар) с помощью /api/v3/exchangeInfo,
 * фильтрует их по критерию status === 'TRADING', и возвращает множества строк —
 * т.е. «активных» символов, для которых ведётся торговля.
 *
 * @returns Множество (Set) строк, где каждая строка — это символ (например, 'BTCUSDT'),
 *          имеющий статус 'TRADING'.
 * @throws Если ответ от Binance не успешен (status не OK).
 */
async function getTradingSymbols(): Promise<Set<string>> {
    const exchangeInfoResp = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    if (!exchangeInfoResp.ok) {
        throw new Error(
            `Failed to fetch exchangeInfo: ${exchangeInfoResp.status} ${exchangeInfoResp.statusText}`
        );
    }
    const exchangeInfo = await exchangeInfoResp.json();

    // exchangeInfo.symbols — массив объектов, соответствующих ExchangeSymbol
    const allSymbols: ExchangeSymbol[] = exchangeInfo.symbols;

    // Фильтруем только те, у которых status === "TRADING". Возвращаем Set<string> с названиями символов
    return new Set(allSymbols
        .filter((sym) => sym.status === 'TRADING')
        .map((sym) => sym.symbol));
}

/**
 * Преобразует массив Ticker[] в массив объектов со строковым price.
 */
function toReadable(tickers: Ticker[]): Array<{ symbol: string; price: string }> {
    return tickers.map((ticker) => ({
        symbol: ticker.symbol,
        price: ticker.price.toString(),
    }));
}

main();
