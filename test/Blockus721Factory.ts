import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Blockus721Factory", function () {
  // Fixture to reuse the same setup in every test
  async function deployFactoryFixture() {
    // Get signers
    const [owner, trustedForwarder, user1, user2] = await hre.ethers.getSigners();

    // Default deployment fee
    const initialDeploymentFee = ethers.parseEther("0.01");

    // Deploy the Blockus721Factory contract
    const Blockus721Factory = await hre.ethers.getContractFactory("Blockus721Factory");
    const factory = await Blockus721Factory.deploy(
      owner.address,
      trustedForwarder.address,
      initialDeploymentFee
    );

    return { factory, owner, trustedForwarder, user1, user2, initialDeploymentFee };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should set the right default trusted forwarder", async function () {
      const { factory, trustedForwarder } = await loadFixture(deployFactoryFixture);
      expect(await factory.defaultTrustedForwarder()).to.equal(trustedForwarder.address);
    });

    it("Should set the initial deployment fee", async function () {
      const { factory, initialDeploymentFee } = await loadFixture(deployFactoryFixture);
      expect(await factory.deploymentFee()).to.equal(initialDeploymentFee);
    });

    it("Should start unpaused", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      expect(await factory.paused()).to.be.false;
    });
  });

  describe("Deploying Single NFT Contract", function () {
    it("Should deploy a new Blockus721Simple contract", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const name = "Test NFT";
      const symbol = "TST";
      const baseURI = "https://test.uri/";
      const contractOwner = user1.address;
      const isSoulbound = false;

      // Deploy the NFT contract and check for the event
      await expect(
        factory.connect(user1).deployNFT(
          name,
          symbol,
          baseURI,
          contractOwner,
          isSoulbound,
          { value: initialDeploymentFee }
        )
      )
      .to.emit(factory, "ContractDeployed")
      .withArgs(user1.address, anyValue, name, symbol, isSoulbound);
    });

    it("Should revert if insufficient fee is sent", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const name = "Test NFT";
      const symbol = "TST";
      const baseURI = "https://test.uri/";
      const contractOwner = user1.address;
      const isSoulbound = false;
      const insufficientFee = initialDeploymentFee - 1n;

      await expect(
        factory.connect(user1).deployNFT(
          name,
          symbol,
          baseURI,
          contractOwner,
          isSoulbound,
          { value: insufficientFee }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidBatchFee").withArgs(initialDeploymentFee, insufficientFee);
    });
  });

  describe("Batch Deployment", function () {
    it("Should batch deploy multiple Blockus721Simple contracts", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const count = 3;
      const names = Array(count).fill("Test NFT");
      const symbols = Array(count).fill("TST");
      const baseURIs = Array(count).fill("https://test.uri/");
      const contractOwners = Array(count).fill(user1.address);
      const isSoulbounds = Array(count).fill(false);
      const totalFee = initialDeploymentFee * BigInt(count);

      const tx = await factory.connect(user1).batchDeploy(
        names,
        symbols,
        baseURIs,
        contractOwners,
        isSoulbounds,
        { value: totalFee }
      );

      const receipt = await tx.wait();
      const contractDeployedEvents = receipt?.logs.filter(
        (log: any) => log.fragment && log.fragment.name === "ContractDeployed"
      );
      expect(contractDeployedEvents?.length).to.equal(count);
    });

    it("Should revert batch deployment if array lengths mismatch", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const count = 3;
      const names = Array(count).fill("Test NFT");
      const symbols = Array(count).fill("TST");
      const baseURIs = Array(count).fill("https://test.uri/");
      const contractOwners = Array(count).fill(user1.address);
      const isSoulbounds = Array(count - 1).fill(false); // Mismatch here
      const totalFee = initialDeploymentFee * BigInt(count);

      await expect(
        factory.connect(user1).batchDeploy(
          names,
          symbols,
          baseURIs,
          contractOwners,
          isSoulbounds,
          { value: totalFee }
        )
      ).to.be.revertedWithCustomError(factory, "ArrayLengthMismatch");
    });

    it("Should revert batch deployment if insufficient fee is sent", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const count = 3;
      const names = Array(count).fill("Test NFT");
      const symbols = Array(count).fill("TST");
      const baseURIs = Array(count).fill("https://test.uri/");
      const contractOwners = Array(count).fill(user1.address);
      const isSoulbounds = Array(count).fill(false);
      const totalFee = initialDeploymentFee * BigInt(count);
      const insufficientFee = totalFee - 1n;

      await expect(
        factory.connect(user1).batchDeploy(
          names,
          symbols,
          baseURIs,
          contractOwners,
          isSoulbounds,
          { value: insufficientFee }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidBatchFee").withArgs(totalFee, insufficientFee);
    });

    it("Should revert batch deployment if count is 0", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const count = 0;
      const names: string[] = [];
      const symbols: string[] = [];
      const baseURIs: string[] = [];
      const contractOwners: string[] = [];
      const isSoulbounds: boolean[] = [];
      const totalFee = initialDeploymentFee * BigInt(count);

      await expect(
        factory.connect(user1).batchDeploy(
          names,
          symbols,
          baseURIs,
          contractOwners,
          isSoulbounds,
          { value: totalFee }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidAmount").withArgs(0);
    });

    it("Should revert batch deployment if count exceeds limit (20)", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const count = 21;
      const names = Array(count).fill("Test NFT");
      const symbols = Array(count).fill("TST");
      const baseURIs = Array(count).fill("https://test.uri/");
      const contractOwners = Array(count).fill(user1.address);
      const isSoulbounds = Array(count).fill(false);
      const totalFee = initialDeploymentFee * BigInt(count);

      await expect(
        factory.connect(user1).batchDeploy(
          names,
          symbols,
          baseURIs,
          contractOwners,
          isSoulbounds,
          { value: totalFee }
        )
      ).to.be.revertedWithCustomError(factory, "BatchLimitExceeded").withArgs(20, count);
    });
  });

  describe("Fee Collection and Withdrawal", function () {
    it("Should collect deployment fees", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const name = "Test NFT";
      const symbol = "TST";
      const baseURI = "https://test.uri/";
      const contractOwner = user1.address;
      const isSoulbound = false;

      const initialFactoryBalance = await ethers.provider.getBalance(await factory.getAddress());

      await factory.connect(user1).deployNFT(
        name,
        symbol,
        baseURI,
        contractOwner,
        isSoulbound,
        { value: initialDeploymentFee }
      );

      const finalFactoryBalance = await ethers.provider.getBalance(await factory.getAddress());
      expect(finalFactoryBalance).to.equal(initialFactoryBalance + initialDeploymentFee);
    });

    it("Should allow owner to withdraw collected fees", async function () {
      const { factory, owner, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const name = "Test NFT";
      const symbol = "TST";
      const baseURI = "https://test.uri/";
      const contractOwner = user1.address;
      const isSoulbound = false;

      // Deploy an NFT to collect fees
      await factory.connect(user1).deployNFT(
        name,
        symbol,
        baseURI,
        contractOwner,
        isSoulbound,
        { value: initialDeploymentFee }
      );

      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      const factoryBalance = await ethers.provider.getBalance(await factory.getAddress());

      // Withdraw fees
      await expect(factory.connect(owner).withdrawFees(owner.address))
        .to.emit(factory, "FeeWithdrawal")
        .withArgs(owner.address, factoryBalance);

      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      const finalFactoryBalance = await ethers.provider.getBalance(await factory.getAddress());

      expect(finalFactoryBalance).to.equal(0);
      // Check owner's balance increased by approximately the factory balance (accounting for gas)
      expect(finalOwnerBalance).to.be.closeTo(initialOwnerBalance + factoryBalance, ethers.parseEther("0.001"));
    });

    it("Should revert when non-owner tries to withdraw fees", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const name = "Test NFT";
      const symbol = "TST";
      const baseURI = "https://test.uri/";
      const contractOwner = user1.address;
      const isSoulbound = false;

      // Deploy an NFT to collect fees
      await factory.connect(user1).deployNFT(
        name,
        symbol,
        baseURI,
        contractOwner,
        isSoulbound,
        { value: initialDeploymentFee }
      );

      // Try to withdraw fees as non-owner
      await expect(factory.connect(user1).withdrawFees(user1.address))
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Should revert when withdrawing fees with no balance", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);

      // Try to withdraw fees when factory balance is 0
      await expect(factory.connect(owner).withdrawFees(owner.address))
        .to.be.revertedWithCustomError(factory, "NoFeesToWithdraw");
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to set deployment fee", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      const newFee = ethers.parseEther("0.05");

      await factory.connect(owner).setDeploymentFee(newFee);
      expect(await factory.deploymentFee()).to.equal(newFee);
    });

    it("Should revert when non-owner tries to set deployment fee", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      const newFee = ethers.parseEther("0.05");

      await expect(factory.connect(user1).setDeploymentFee(newFee))
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to set default trusted forwarder", async function () {
      const { factory, owner, user1 } = await loadFixture(deployFactoryFixture);
      const newForwarder = user1.address;

      await factory.connect(owner).setDefaultTrustedForwarder(newForwarder);
      expect(await factory.defaultTrustedForwarder()).to.equal(newForwarder);
    });

    it("Should revert when non-owner tries to set default trusted forwarder", async function () {
      const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);
      const newForwarder = user2.address;

      await expect(factory.connect(user1).setDefaultTrustedForwarder(newForwarder))
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pause/Unpause Functionality", function () {
    it("Should allow owner to pause and unpause the factory", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);

      // Pause
      await factory.connect(owner).pause();
      expect(await factory.paused()).to.be.true;

      // Unpause
      await factory.connect(owner).unpause();
      expect(await factory.paused()).to.be.false;
    });

    it("Should revert when non-owner tries to pause or unpause", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      // Try to pause as non-owner
      await expect(factory.connect(user1).pause())
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      // Try to unpause as non-owner
      await expect(factory.connect(user1).unpause())
        .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Should revert deployment when the factory is paused", async function () {
      const { factory, owner, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      // Pause the factory
      await factory.connect(owner).pause();

      const name = "Test NFT";
      const symbol = "TST";
      const baseURI = "https://test.uri/";
      const contractOwner = user1.address;
      const isSoulbound = false;

      // Try to deploy an NFT while paused
      await expect(
        factory.connect(user1).deployNFT(
          name,
          symbol,
          baseURI,
          contractOwner,
          isSoulbound,
          { value: initialDeploymentFee }
        )
      ).to.be.revertedWithCustomError(factory, "EnforcedPause");
    });
  });

  describe("View Functions", function () {
    it("Should return contracts deployed by a specific address", async function () {
      const { factory, user1, user2, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      // Deploy some contracts from user1
      await factory.connect(user1).deployNFT("NFT1", "N1", "uri1", user1.address, false, { value: initialDeploymentFee });
      await factory.connect(user1).deployNFT("NFT2", "N2", "uri2", user1.address, false, { value: initialDeploymentFee });

      // Deploy some contracts from user2
      await factory.connect(user2).deployNFT("NFT3", "N3", "uri3", user2.address, false, { value: initialDeploymentFee });

      const user1Contracts = await factory.getDeployerContracts(user1.address);
      const user2Contracts = await factory.getDeployerContracts(user2.address);
      const ownerContracts = await factory.getDeployerContracts(factory.owner());
      expect(user1Contracts.length).to.equal(2);
      expect(user2Contracts.length).to.equal(1);
      expect(ownerContracts.length).to.equal(0);
    });

    it("Should return the total number of deployed contracts", async function () {
      const { factory, user1, user2, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      expect(await factory.getTotalDeployedContracts()).to.equal(0);

      await factory.connect(user1).deployNFT("NFT1", "N1", "uri1", user1.address, false, { value: initialDeploymentFee });
      expect(await factory.getTotalDeployedContracts()).to.equal(1);

      await factory.connect(user2).deployNFT("NFT2", "N2", "uri2", user2.address, false, { value: initialDeploymentFee });
      expect(await factory.getTotalDeployedContracts()).to.equal(2);

      const count = 5;
      const names = Array(count).fill("Test NFT");
      const symbols = Array(count).fill("TST");
      const baseURIs = Array(count).fill("https://test.uri/");
      const contractOwners = Array(count).fill(user1.address);
      const isSoulbounds = Array(count).fill(false);
      const totalFee = initialDeploymentFee * BigInt(count);

      await factory.connect(user1).batchDeploy(names, symbols, baseURIs, contractOwners, isSoulbounds, { value: totalFee });
      expect(await factory.getTotalDeployedContracts()).to.equal(2 + count);
    });

    it("Should return a paginated list of deployed contracts", async function () {
      const { factory, user1, initialDeploymentFee } = await loadFixture(deployFactoryFixture);

      const count = 10;
      const names = Array(count).fill("Test NFT");
      const symbols = Array(count).fill("TST");
      const baseURIs = Array(count).fill("https://test.uri/");
      const contractOwners = Array(count).fill(user1.address);
      const isSoulbounds = Array(count).fill(false);
      const totalFee = initialDeploymentFee * BigInt(count);

      await factory.connect(user1).batchDeploy(names, symbols, baseURIs, contractOwners, isSoulbounds, { value: totalFee });

      const total = await factory.getTotalDeployedContracts();
      expect(total).to.equal(10);

      // Get first 5 contracts
      const firstPage = await factory.getDeployedContracts(0, 5);
      expect(firstPage.length).to.equal(5);

      // Get next 5 contracts
      const secondPage = await factory.getDeployedContracts(5, 10);
      expect(secondPage.length).to.equal(5);

      // Get all contracts
      const allContracts = await factory.getDeployedContracts(0, 10);
      expect(allContracts.length).to.equal(10);

      // Revert on invalid range
      await expect(factory.getDeployedContracts(5, 3)).to.be.revertedWithCustomError(factory, "InvalidPaginationRange").withArgs(5, 3, total);
      await expect(factory.getDeployedContracts(0, 11)).to.be.revertedWithCustomError(factory, "InvalidPaginationRange").withArgs(0, 11, total);
    });
  });
});