const {
  http,
  encodePacked,
  toHex,
  isAddress,
  createPublicClient,
  createWalletClient,
  getContract,
} = require("viem");
require("dotenv").config();
const { polygon } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const routeProcessorABI = require("./abi.json");
const publicClient = createPublicClient({ chain: polygon, transport: http() });
const walletClient = createWalletClient({
  chain: polygon,
  transport: http(),
  account: privateKeyToAccount(process.env.PK),
});
const sushiRouteProcessor = getContract({
  abi: routeProcessorABI,
  address: process.env.SUSHI_ROUTE_PROCESSOR,
  client: walletClient,
});

async function submitSushiTx(amountIn, pair, tokenToSnipe, account) {
  var to = account.address;
  var route = encodeRoute(pair, process.env.SUSHI_WRAP_TOKEN, to);
  console.log("Simulating route...");
  var amountOut = await publicClient.simulateContract({
    address: process.env.SUSHI_ROUTE_PROCESSOR,
    abi: routeProcessorABI,
    functionName: "processRoute",
    args: [process.env.NATIVE_TOKEN, amountIn, tokenToSnipe, 0, to, route],
    value: amountIn,
  });
  amountOut = amountOut.result;
  console.log("Amount out: " + amountOut);
  amountOut = parseInt(amountOut);
  var amountOutMin = parseInt(amountOut - amountOut * 0.5);
  console.log("Sending transaction...");
  var hash = await sushiRouteProcessor.write.processRoute(
    [process.env.NATIVE_TOKEN, amountIn, tokenToSnipe, amountOutMin, to, route],
    { value: amountIn, gas: 300000n }
  );
  console.log("Transaction hash: " + hash);
  return hash;
}

function encodeRoute(pair, warpMatic, to) {
  var params = {
    wrap: {
      command: 3,
      pools: 1,
      share: 65535, //largest uint16?
      poolType: 2, // for uniswap wrap native (got from contract)
      direction: 1, // ->
      pair: pair,
      wrapMatic: warpMatic,
    },
    route: {
      command: 4,
      wrapMatic: warpMatic,
      poolType: 0, // for uniswap v2
      pair: pair,
      direction: 1, // <-
    },
  };
  var paramsArr = [
    ...Object.values(params.wrap).map((val) => {
      if (!isAddress(val)) {
        return toHex(val);
      } else return val;
    }),
    ...Object.values(params.route).map((val) => {
      if (!isAddress(val)) {
        return toHex(val);
      } else return val;
    }),
    ...[to, toHex(3000)],
  ];
  // COMMENTS FOR FUTURE CHANGES
  var route = encodePacked(
    [
      //WRAPPING PARAMS
      "uint8", // COMMAND CODE
      "uint8", // NUMBER OF POOLS
      "uint16", // SHARE IN POOL
      "uint8", // POOL TYPE
      "uint8", // DIRECTION
      "address", // PAIR
      "address", // WRAP MATIC
      //ROUTE PARAMS
      "uint8", //COMMAND
      "address", // WRAP MATIC
      "uint8", // POOL TYPE
      "address", // PAIR
      "uint8", // DIRECTION
      "address", // TO:DESTINATION
      "uint24", // FEE IN BIPS SETTING (0.3%) CHANGE IN FUTURE
    ],
    paramsArr
  );
  return route;
}
module.exports = submitSushiTx;

//test
// submitSushiTx(
//   500000000000000000n,
//   "0x55ff76bffc3cdd9d5fdbbc2ece4528ecce45047e",
//   "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
//   "0x0f2e359DE7769c155b08DC5342aEA80eb3fC8C64"
// );
