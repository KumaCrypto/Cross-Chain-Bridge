/* eslint-disable prettier/prettier */
/* eslint-disable node/no-unpublished-import */
import { task } from "hardhat/config";


const contractAddress = "0x4896a523302E3613F052b48bBdd4efe20b4B683F";

task("swap", "Swap your tokens to another chain")
    .addParam("receiver", "Receiver address on another chain")
    .addParam("amount", "Amount of tokens")
    .addParam("chainTo", "On which chain send tokens?")
    .addParam("nonce", "Your nonce")
    .addParam("symbol", "Token symbol")
    .setAction(async function (taskArgs, hre) {
        const bridge = await hre.ethers.getContractAt("Bridge", contractAddress);

        await bridge.swap(taskArgs.receiver,
            taskArgs.amount,
            taskArgs.chainTo,
            taskArgs.nonce,
            taskArgs.symbol
        );
    });

task("redeem", "Take your tokens")
    .addParam("receiver", "Receiver address on another chain")
    .addParam("symbol", "Token symbol")
    .addParam("amount", "Amount of tokens")
    .addParam("nonce", "Your nonce")
    .addParam("chainTo", "This chainId")
    .addParam("v", "v part of signature")
    .addParam("r", "r part of signature")
    .addParam("s", "s part of signature")
    .setAction(async function (taskArgs, hre) {
        const bridge = await hre.ethers.getContractAt("Bridge", contractAddress);

        await bridge.redeem(
            taskArgs.receiver,
            taskArgs.symbol,
            taskArgs.amount,
            taskArgs.nonce,
            taskArgs.chainTo,
            taskArgs.v,
            taskArgs.r,
            taskArgs.s
        );
    });
