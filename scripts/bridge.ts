import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import Bridge from "../artifacts/contracts/Bridge.sol/Bridge.json";

const BridgeAddress = "0x85a874323BE23f6ce61Cb6A5317e1Ba7cEE4ec73";

async function main() {
    const [validator]: SignerWithAddress[] = await ethers.getSigners();
    const provider = new ethers.providers.AlchemyProvider("rinkeby", process.env.ALCHEMY_RINKEBY_API_KEY);
    const bridge = new ethers.Contract(BridgeAddress, Bridge.abi, provider);

    // Alchemy only works with certain blockchains, so let’s introduce a convention:
    // that this logic only works with Ethereum, Arbitrum, Polygon, Optimism.
    // But if you use another provider, then with other chains too.

    console.log("Try to listen...");
    bridge.on("SwapInitilaized", async (receiver, token, amount, nonce, chainTo) => {
        const encoded = new ethers.utils.AbiCoder().encode(
            ["address", "address", "uint256", "uint256", "uint256"],
            [receiver, token, amount, nonce, chainTo]
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

        console.log(`
        receiver = ${receiver},
        token = ${token},
        amount = ${amount},
        nonce = ${nonce},
        chainTo = ${chainTo}`
        );
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

