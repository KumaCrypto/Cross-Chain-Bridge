import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import Bridge from "../artifacts/contracts/Bridge.sol/Bridge.json";


const BridgeAddress = "0x98C77D8E65E75265151FDB26C06e03e0F763aaFF";

async function main() {
    const [validator]: SignerWithAddress[] = await ethers.getSigners();
    const provider = new ethers.providers.AlchemyProvider("rinkeby", process.env.ALCHEMY_RINKEBY_API_KEY);
    const bridge = new ethers.Contract(BridgeAddress, Bridge.abi, provider);

    // Kuma comment:
    // Alchemy only works with certain blockchains, so let’s introduce a convention:
    // that this logic only works with Ethereum, Arbitrum, Polygon, Optimism.
    // But if you use another provider, then with other chains too.

    console.log("Try to catch an event...");
    bridge.on("SwapInitilaized", async (receiver, token, chainTo, amount, nonce) => {
        const encoded = new ethers.utils.AbiCoder().encode(
            ["address", "address", "uint256", "uint256", "uint256"],
            [receiver, token, chainTo, amount, nonce]
        );

        const signedDataHash = ethers.utils.solidityKeccak256(
            ["bytes"], [encoded]
        );

        // At this step we are making ethers to treat data as bytes array,
        // not string
        const bytesArray = ethers.utils.arrayify(signedDataHash);

        const flatSignature = await validator.signMessage(bytesArray);

        // We signed everything, but before knocking contract, we have to
        // split signature into 3 different components - v, r, s.
        const signature = ethers.utils.splitSignature(flatSignature);

        // here are v, r and s - components of single EC digital signature
        console.log(`
            v = ${signature.v},
            r = ${signature.r},
            s = ${signature.s}
        `);
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
