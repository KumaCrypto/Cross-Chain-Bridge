/* eslint-disable node/no-missing-import */
/* eslint-disable camelcase */
/* eslint-disable prettier/prettier */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Signature } from "ethers";
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

  let ETH_Id: number = 1;
  let BSC_Id: number = 56;

  let defaultAmount: number = 100;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    [validator, user, user2] = [signers[0], signers[1], signers[2]];

    ETH_bridge = await new Bridge__factory(validator).deploy(validator.address, ETH_Id);
    BSC_bridge = await new Bridge__factory(validator).deploy(validator.address, BSC_Id);

    ETH_Token = await new TestToken__factory(validator).deploy(ETH_bridge.address);
    BSC_Token = await new TestToken__factory(validator).deploy(BSC_bridge.address);

    await ETH_bridge.updateChainByld(BSC_Id, true);
    await BSC_bridge.updateChainByld(ETH_Id, true);

    await BSC_bridge.includeToken(ETH_Token.address, "ETH");
    await BSC_bridge.includeToken(BSC_Token.address, "BNB");

    await ETH_bridge.includeToken(ETH_Token.address, "ETH");
    await ETH_bridge.includeToken(BSC_Token.address, "BNB");


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
      expect(await ETH_bridge.isTokenSupported("ETH")).to.eq(true);
    });

    it("isTokenSupported = false", async () => {
      expect(await ETH_bridge.isTokenSupported("CAKE")).to.eq(false);
    });

    it("isChainSupported = true", async () => {
      expect(await ETH_bridge.isChainSupported(BSC_Id)).to.eq(true);
    });

    it("isChainSupported = false", async () => {
      expect(await ETH_bridge.isChainSupported(100)).to.eq(false);
    });

    it("getBridgeChainId", async () => {
      expect(await ETH_bridge.getBridgeChainId()).to.eq(ETH_Id);
    });

    it("nonceStatus = false", async () => {
      expect(await ETH_bridge.nonceStatus(user.address, 1)).to.eq(false);
    });

    it("nonceStatus = true", async () => {
      await ETH_bridge.connect(user).swap(user2.address, defaultAmount, BSC_Id, 1, "ETH");
      expect(await ETH_bridge.nonceStatus(user.address, 1)).to.eq(true);
    });

    it("getToken", async () => {
      expect(await ETH_bridge.getToken("ETH")).to.eq(ETH_Token.address);
    });
  });

  describe("Checking setters", () => {
    const MyAddress = "0xF7A623297100b5Df95FeDDe19361584B1Ef5Ab8c";

    it("updateChainByld = true", async () => {
      await ETH_bridge.updateChainByld(777, true);
      expect(await ETH_bridge.isChainSupported(777)).to.eq(true);
    });

    it("updateChainByld = false", async () => {
      await ETH_bridge.updateChainByld(777, true);
      await ETH_bridge.updateChainByld(777, false);
      expect(await ETH_bridge.isChainSupported(777)).to.eq(false);
    });

    it("updateChainByld - emit ChainByldUpdated", async () => {
      await expect(ETH_bridge.updateChainByld(777, true))
        .to.emit(ETH_bridge, "ChainByldUpdated")
        .withArgs(777, true);
    });

    it("includeToken", async () => {
      await ETH_bridge.includeToken(
        MyAddress,
        "MyAddress"
      );
      expect(await ETH_bridge.getToken("MyAddress")).to.eq(MyAddress);
      expect(await ETH_bridge.isTokenSupported("MyAddress")).to.eq(true);
    });

    it("includeToken - emit TokenIncluded", async () => {
      await expect(ETH_bridge.includeToken(MyAddress, "MyAddress")
      ).to.emit(ETH_bridge, "TokenIncluded").withArgs(MyAddress, "MyAddress");
    });

    it("excludeToken", async () => {
      await ETH_bridge.excludeToken("ETH");

      expect(await ETH_bridge.getToken("ETH")).to.eq(ethers.constants.AddressZero);
      expect(await ETH_bridge.isTokenSupported("ETH")).to.eq(false);
    });

    it("excludeToken - emit TokenExcluded", async () => {
      await expect(ETH_bridge.excludeToken("ETH"))
        .to.emit(ETH_bridge, "TokenExcluded").withArgs("ETH");
    });
  });

  describe("modifiers", () => {

    it("adminControl", async () => {
      await expect(ETH_bridge.connect(user).excludeToken("ETH"))
        .to.be.revertedWith("Bridge: Only admin can use this function");
    });

    it("checkNonce", async () => {
      await ETH_bridge.connect(user).swap(user2.address, defaultAmount, BSC_Id, 1, "ETH");
      await expect(ETH_bridge.connect(user).swap(user2.address, defaultAmount, BSC_Id, 1, "ETH"))
        .to.be.revertedWith("Bridge: This nonce was already used");
    });

    it("TokenSupported", async () => {
      await expect(ETH_bridge.connect(user)
        .swap(user2.address, defaultAmount, BSC_Id, 1, "CAKE"))
        .to.be.revertedWith("Bridge: This token is not supported");
    });
  });

  describe("main functions", () => {

    it("swap - chain isn't supported", async () => {
      await expect(
        ETH_bridge.connect(user).swap(user2.address, defaultAmount, 777, 1, "ETH"))
        .to.be.revertedWith("Bridge: One of the blockchains isn't supported");
    });

    it("swap burned tokens", async () => {
      const totalSupplyBefore = await ETH_Token.totalSupply();
      await ETH_bridge.connect(user).swap(user2.address, defaultAmount, BSC_Id, 1, "ETH");
      const totalSupply = await ETH_Token.totalSupply();

      expect(totalSupplyBefore).to.eq(totalSupply.add(defaultAmount));
    });

    it("swap - emit SwapInitilaized", async () => {
      await expect(
        ETH_bridge.connect(user).swap(
          user2.address,
          defaultAmount,
          BSC_Id,
          1,
          "ETH"
        )
      ).to.emit(ETH_bridge, "SwapInitilaized").withArgs(
        user2.address,
        ETH_Token.address,
        defaultAmount,
        1,
        ETH_Id,
        BSC_Id
      );
    });
  });

  describe("redeem", () => {
    let signature: Signature;

    beforeEach(async function () {
      await ETH_bridge.connect(user).swap(user2.address, defaultAmount, BSC_Id, 1, "ETH");

      const signedDataHash = ethers.utils.solidityKeccak256(
        ["address", "address", "uint256", "uint256", "uint256",],
        [user2.address, await BSC_bridge.getToken("ETH"), defaultAmount, 1, BSC_Id]
      );

      const bytesArray = ethers.utils.arrayify(signedDataHash);

      const flatSignature = await validator.signMessage(bytesArray);
      signature = ethers.utils.splitSignature(flatSignature);
    });

    it("isn't a msg.sender", async () => {
      await expect(
        BSC_bridge.redeem(
          user2.address,
          "ETH",
          defaultAmount,
          1,
          BSC_Id,
          signature.v,
          signature.r,
          signature.s
        )
      ).to.be.revertedWith("Only the receiver can collect the tokens");
    });

    it("For another chain", async () => {
      await expect(
        BSC_bridge.connect(user2).redeem(
          user2.address,
          "ETH",
          defaultAmount,
          1,
          BSC_Id + 1, //Special incorrect
          signature.v,
          signature.r,
          signature.s
        )
      ).to.be.revertedWith("This transaction is for another chain");
    });

    // The next test is unsuccessful, need to figure out why?
    it("BED TEST", async () => {
      const receiverBalanceBefore = await ETH_Token.balanceOf(user2.address);
      BSC_bridge.connect(user2).redeem(
        user2.address,
        "ETH",
        defaultAmount,
        1,
        BSC_Id,
        signature.v,
        signature.r,
        signature.s
      );

      // Error: VM Exception while processing transaction: reverted with reason string
      // 'AccessControl: account 0x53927b50bade6756ef77463e13a73ab3ed561ed2 is missing role
      // 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'

      const receiverBalance = await ETH_Token.balanceOf(user2.address);
      expect(receiverBalanceBefore.add(defaultAmount)).to.eq(receiverBalance);
    });
  });

});