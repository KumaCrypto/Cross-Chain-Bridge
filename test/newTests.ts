/* eslint-disable prettier/prettier */
/* eslint-disable node/no-missing-import */
/* eslint-disable camelcase */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signature } from "ethers";
import { ethers } from "hardhat";

import {
    Bridge,
    Bridge__factory,
    TestToken,
    TestToken__factory,
} from "../typechain-types";

describe("Bridge", function () {
    let ETH_bridge: Bridge;
    let BSC_bridge: Bridge;
    let ETH_Token: TestToken;
    let BSC_Token: TestToken;

    let signers: SignerWithAddress[];
    let validator: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;

    const ETH_Id: number = 1;
    const BSC_Id: number = 56;

    const defaultAmount: number = 100;
    const wrongChainId: number = 555;
    const addreessForTests = "0xF7A623297100b5Df95FeDDe19361584B1Ef5Ab8c";

    beforeEach(async function () {
        signers = await ethers.getSigners();
        [validator, user, user2] = [signers[0], signers[1], signers[2]];

        ETH_bridge = await new Bridge__factory(validator).deploy(validator.address, ETH_Id);
        BSC_bridge = await new Bridge__factory(validator).deploy(validator.address, BSC_Id);

        ETH_Token = await new TestToken__factory(validator).deploy(BSC_bridge.address);
        BSC_Token = await new TestToken__factory(validator).deploy(ETH_bridge.address);

        await ETH_bridge.updateChainById(BSC_Id, true);
        await BSC_bridge.updateChainById(ETH_Id, true);

        await BSC_bridge.includeToken(BSC_Token.address, ETH_Token.address, ETH_Id);
        await ETH_bridge.includeToken(ETH_Token.address, BSC_Token.address, BSC_Id);


        await BSC_Token.transfer(user.address, 1000);
        await BSC_Token.transfer(user2.address, 1000);

        await ETH_Token.transfer(user.address, 1000);
        await ETH_Token.transfer(user2.address, 1000);

        await ETH_Token.connect(user).approve(ETH_bridge.address, 1000);
        await ETH_Token.connect(user2).approve(ETH_bridge.address, 1000);

        await BSC_Token.connect(user).approve(BSC_bridge.address, 1000);
        await BSC_Token.connect(user2).approve(BSC_bridge.address, 1000);
    });

    describe("Checking getters", () => {

        it("isTokenSupported = true", async () => {
            expect(await ETH_bridge.isTokenSupported(ETH_Token.address, BSC_Id)).to.eq(true);
        });

        it("isTokenSupported = false", async () => {
            expect(await ETH_bridge.isTokenSupported(ETH_Token.address, wrongChainId)).to.eq(false);
        });

        it("isChainSupported = true", async () => {
            expect(await ETH_bridge.isChainSupported(BSC_Id)).to.eq(true);
        });

        it("isChainSupported = false", async () => {
            expect(await ETH_bridge.isChainSupported(100)).to.eq(false);
        });

        it("nonceStatus = false", async () => {
            expect(await ETH_bridge.nonceStatus(user.address, 1)).to.eq(false);
        });

        it("nonceStatus = true", async () => {
            await ETH_bridge.connect(user).swap(user2.address, ETH_Token.address, defaultAmount, BSC_Id, 1);
            expect(await ETH_bridge.nonceStatus(user.address, 1)).to.eq(true);
        });
    });

    describe("Checking setters", () => {

        it("updateChainById = true", async () => {
            await ETH_bridge.updateChainById(777, true);
            expect(await ETH_bridge.isChainSupported(777)).to.eq(true);
        });

        it("updateChainById = false", async () => {
            await ETH_bridge.updateChainById(777, true);
            await ETH_bridge.updateChainById(777, false);
            expect(await ETH_bridge.isChainSupported(777)).to.eq(false);
        });

        it("updateChainById - emit ChainByIdUpdated", async () => {
            await expect(ETH_bridge.updateChainById(777, true))
                .to.emit(ETH_bridge, "ChainByIdUpdated")
                .withArgs(777, true);
        });

        it("includeToken", async () => {
            await ETH_bridge.includeToken(
                addreessForTests,
                addreessForTests,
                wrongChainId
            );
            expect(await ETH_bridge.isTokenSupported(addreessForTests, wrongChainId)).to.eq(true);
        });

        it("includeToken - emit TokenIncluded", async () => {
            await expect(ETH_bridge.includeToken(
                addreessForTests,
                addreessForTests,
                wrongChainId
            )
            ).to.emit(ETH_bridge, "TokenIncluded").withArgs(
                addreessForTests,
                addreessForTests,
                wrongChainId
            );
        });

        it("excludeToken", async () => {
            await ETH_bridge.excludeToken(ETH_Token.address, BSC_Id);

            expect(await ETH_bridge.isTokenSupported(ETH_Token.address, BSC_Id)).to.eq(false);
        });

        it("excludeToken - emit TokenExcluded", async () => {
            await expect(ETH_bridge.excludeToken(ETH_Token.address, BSC_Id))
                .to.emit(ETH_bridge, "TokenExcluded").withArgs(ETH_Token.address, BSC_Id);
        });
    });

    describe("modifiers", () => {

        it("adminControl", async () => {
            await expect(ETH_bridge.connect(user).excludeToken(ETH_Token.address, BSC_Id))
                .to.be.revertedWith("Bridge: Only admin can use this function");
        });

        it("checkNonce", async () => {
            await ETH_bridge.connect(user).swap(user2.address, ETH_Token.address, defaultAmount, BSC_Id, 1);
            await expect(ETH_bridge.connect(user).swap(user2.address, ETH_Token.address, defaultAmount, BSC_Id, 1))
                .to.be.revertedWith("Bridge: This nonce was already used");
        });
    });

    describe("main functions", () => {
        describe("swap", () => {

            it("swap - chain isn't supported", async () => {
                await expect(
                    ETH_bridge.connect(user).swap(user2.address, ETH_Token.address, defaultAmount, wrongChainId, 1))
                    .to.be.revertedWith("Bridge: One of the blockchains isn't supported");
            });

            it("swap - token isn't supported", async () => {
                await expect(
                    ETH_bridge.connect(user).swap(user2.address, addreessForTests, defaultAmount, BSC_Id, 1))
                    .to.be.revertedWith("Bridge: This token is not supported");
            });

            it("swap burned tokens", async () => {
                const totalSupplyBefore = await ETH_Token.totalSupply();
                await ETH_bridge.connect(user).swap(user2.address, ETH_Token.address, defaultAmount, BSC_Id, 1);
                const totalSupply = await ETH_Token.totalSupply();

                expect(totalSupplyBefore).to.eq(totalSupply.add(defaultAmount));
            });

            it("swap - emit SwapInitilaized", async () => {
                await expect(
                    ETH_bridge.connect(user).swap(
                        user2.address, ETH_Token.address, defaultAmount, BSC_Id, 1
                    )
                ).to.emit(ETH_bridge, "SwapInitilaized").withArgs(
                    user2.address, BSC_Token.address, BSC_Id, defaultAmount, 1, ETH_Id
                );
            });
        });
    });

    describe("redeem", () => {
        let signature: Signature;
        beforeEach(async function () {
            await ETH_bridge.connect(user).swap(user2.address, ETH_Token.address, defaultAmount, BSC_Id, 1);

            const encoded = new ethers.utils.AbiCoder().encode(
                ["address", "address", "uint256", "uint256", "uint256"],
                [user2.address, ETH_Token.address, BSC_Id, defaultAmount, 1]
            );

            const signedDataHash = ethers.utils.solidityKeccak256(
                ["bytes"], [encoded]
            );

            const bytesArray = ethers.utils.arrayify(signedDataHash);

            const flatSignature = await validator.signMessage(bytesArray);
            signature = ethers.utils.splitSignature(flatSignature);
        });

        it("isn't a msg.sender", async () => {
            await expect(
                BSC_bridge.redeem(
                    user2.address,
                    ETH_Token.address,
                    defaultAmount,
                    1,
                    BSC_Id,
                    signature.v,
                    signature.r,
                    signature.s
                )
            ).to.be.revertedWith("Only the receiver can collect the tokens");
        });

        it("Invalid sig", async () => {
            await expect(
                BSC_bridge.connect(user2).redeem(
                    user2.address,
                    ETH_Token.address,
                    defaultAmount - 1,
                    1,
                    BSC_Id,
                    signature.v,
                    signature.r,
                    signature.s
                )
            ).to.be.revertedWith("Bridge: invalid sig");
        });

        it("For another chain", async () => {
            await expect(
                BSC_bridge.connect(user2).redeem(
                    user2.address,
                    ETH_Token.address,
                    defaultAmount,
                    1,
                    wrongChainId,
                    signature.v,
                    signature.r,
                    signature.s
                )
            ).to.be.revertedWith("This transaction is for another chain");
        });

        it("Tokens minted", async () => {
            const BalanceBefore = await ETH_Token.balanceOf(user2.address);

            BSC_bridge.connect(user2).redeem(
                user2.address,
                ETH_Token.address,
                defaultAmount,
                1,
                BSC_Id,
                signature.v,
                signature.r,
                signature.s
            );
            const Balance = await ETH_Token.balanceOf(user2.address);
            expect(BalanceBefore.add(defaultAmount)).to.eq(Balance);
        });

        it("Redeem setted a usersNonces", async () => {

            BSC_bridge.connect(user2).redeem(
                user2.address,
                ETH_Token.address,
                defaultAmount,
                1,
                BSC_Id,
                signature.v,
                signature.r,
                signature.s
            );
            expect(await BSC_bridge.nonceStatus(user2.address, 1)).to.eq(true);
        });

        it("Redeem - emit RedeemInitilaized", async () => {
            await expect(BSC_bridge.connect(user2).redeem(
                user2.address,
                ETH_Token.address,
                defaultAmount,
                1,
                BSC_Id,
                signature.v,
                signature.r,
                signature.s
            )).to.emit(BSC_bridge, "RedeemInitilaized")
                .withArgs(user2.address, ETH_Token.address, defaultAmount, 1);
        });
    });

});
