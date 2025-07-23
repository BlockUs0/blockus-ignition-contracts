import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("BlockusPremint", function () {
  // Fixture to reuse the same setup in every test
  async function deployFixture() {
    // Get signers
    const [owner, trustedForwarder, user1, user2, user3] = await hre.ethers.getSigners();

    // NFT configuration
    const name = "Blockus Premint NFT";
    const symbol = "BPNFT";
    const baseURI = "https://api.blockus.com/metadata/";
    const isSoulbound = true;
    const totalSupply = 100; // Smaller number for testing

    // Deploy the contract
    const BlockusPremint = await hre.ethers.getContractFactory("BlockusPremint");
    const nft = await BlockusPremint.deploy(
      name,
      symbol,
      baseURI,
      owner.address,
      trustedForwarder.address,
      isSoulbound,
      totalSupply
    );

    return { 
      nft, 
      name, 
      symbol, 
      baseURI, 
      owner, 
      trustedForwarder, 
      user1, 
      user2, 
      user3, 
      isSoulbound, 
      totalSupply 
    };
  }

  async function deployTransferableFixture() {
    const [owner, trustedForwarder, user1, user2, user3] = await hre.ethers.getSigners();
    const name = "Blockus Premint NFT";
    const symbol = "BPNFT";
    const baseURI = "https://api.blockus.com/metadata/";
    const isSoulbound = false; // Not soulbound
    const totalSupply = 50;

    const BlockusPremint = await hre.ethers.getContractFactory("BlockusPremint");
    const nft = await BlockusPremint.deploy(
      name,
      symbol,
      baseURI,
      owner.address,
      trustedForwarder.address,
      isSoulbound,
      totalSupply
    );

    return { 
      nft, 
      name, 
      symbol, 
      baseURI, 
      owner, 
      trustedForwarder, 
      user1, 
      user2, 
      user3, 
      isSoulbound, 
      totalSupply 
    };
  }

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { nft, name, symbol } = await loadFixture(deployFixture);
      expect(await nft.name()).to.equal(name);
      expect(await nft.symbol()).to.equal(symbol);
    });

    it("Should set the right owner", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("Should set the soulbound status correctly", async function () {
      const { nft, isSoulbound } = await loadFixture(deployFixture);
      expect(await nft.soulbound()).to.equal(isSoulbound);
    });

    it("Should set the total supply correctly", async function () {
      const { nft, totalSupply } = await loadFixture(deployFixture);
      expect(await nft.TOTAL_SUPPLY()).to.equal(totalSupply);
    });

    it("Should start unpaused", async function () {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.paused()).to.be.false;
    });

    it("Should premint all tokens to owner", async function () {
      const { nft, owner, totalSupply } = await loadFixture(deployFixture);
      
      // Check owner balance
      expect(await nft.balanceOf(owner.address)).to.equal(totalSupply);
      
      // Check total supply
      expect(await nft.totalSupply()).to.equal(totalSupply);
      
      // Check first and last token ownership
      expect(await nft.ownerOf(1)).to.equal(owner.address);
      expect(await nft.ownerOf(totalSupply)).to.equal(owner.address);
    });

    it("Should revert with zero total supply", async function () {
      const [owner, trustedForwarder] = await hre.ethers.getSigners();
      const BlockusPremint = await hre.ethers.getContractFactory("BlockusPremint");
      
      await expect(
        BlockusPremint.deploy(
          "Test",
          "TEST",
          "https://test.com/",
          owner.address,
          trustedForwarder.address,
          false,
          0 // Invalid total supply
        )
      ).to.be.revertedWith("Total supply must be greater than 0");
    });

    it("Should revert with too large total supply", async function () {
      const [owner, trustedForwarder] = await hre.ethers.getSigners();
      const BlockusPremint = await hre.ethers.getContractFactory("BlockusPremint");
      
      await expect(
        BlockusPremint.deploy(
          "Test",
          "TEST",
          "https://test.com/",
          owner.address,
          trustedForwarder.address,
          false,
          10001 // Too large
        )
      ).to.be.revertedWith("Total supply too large");
    });
  });

  describe("Inventory Management", function () {
    it("Should allow owner to mark tokens as available", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      const tokenIds = [1, 2, 3];
      await nft.connect(owner).markTokensAvailable(tokenIds);
      
      // Check availability
      expect(await nft.isAvailable(1)).to.be.true;
      expect(await nft.isAvailable(2)).to.be.true;
      expect(await nft.isAvailable(3)).to.be.true;
      
      // Check available count
      expect(await nft.getAvailableCount()).to.equal(3);
      
      // Check available tokens array
      const availableTokens = await nft.getAvailableTokens();
      expect(availableTokens).to.deep.equal([1n, 2n, 3n]);
    });

    it("Should allow owner to mark all owned tokens as available", async function () {
      const { nft, owner, totalSupply } = await loadFixture(deployFixture);
      
      await nft.connect(owner).markAllOwnedTokensAvailable();
      
      // Check that all tokens are available
      expect(await nft.getAvailableCount()).to.equal(totalSupply);
      
      // Check first and last tokens
      expect(await nft.isAvailable(1)).to.be.true;
      expect(await nft.isAvailable(totalSupply)).to.be.true;
    });

    it("Should not allow non-owner to mark tokens as available", async function () {
      const { nft, user1 } = await loadFixture(deployFixture);
      
      await expect(
        nft.connect(user1).markTokensAvailable([1, 2, 3])
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("Should not allow marking invalid token IDs", async function () {
      const { nft, owner, totalSupply } = await loadFixture(deployFixture);
      
      await expect(
        nft.connect(owner).markTokensAvailable([0]) // Invalid token ID
      ).to.be.revertedWith("Invalid token ID");
      
      await expect(
        nft.connect(owner).markTokensAvailable([totalSupply + 1]) // Out of range
      ).to.be.revertedWith("Invalid token ID");
    });

    it("Should not allow marking already available tokens", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      // Mark token as available
      await nft.connect(owner).markTokensAvailable([1]);
      
      // Try to mark the same token again
      await expect(
        nft.connect(owner).markTokensAvailable([1])
      ).to.be.revertedWith("Token already marked as available");
    });
  });

  describe("Transfer Functions", function () {
    it("Should allow owner to transfer specific token to customer", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // Mark token as available
      await nft.connect(owner).markTokensAvailable([1]);
      
      // Transfer to customer
      await nft.connect(owner).transferToCustomer(user1.address, 1);
      
      // Check ownership
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.balanceOf(user1.address)).to.equal(1);
      
      // Check token is no longer available
      expect(await nft.isAvailable(1)).to.be.false;
      expect(await nft.getAvailableCount()).to.equal(0);
    });

    it("Should allow owner to transfer next available token", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // Mark tokens as available
      await nft.connect(owner).markTokensAvailable([5, 10, 15]);
      
      // Transfer next available (should be last added - 15)
      const tokenId = await nft.connect(owner).transferNextAvailable.staticCall(user1.address);
      await nft.connect(owner).transferNextAvailable(user1.address);
      
      // Check ownership
      expect(await nft.ownerOf(tokenId)).to.equal(user1.address);
      expect(await nft.getAvailableCount()).to.equal(2);
    });

    it("Should allow batch transfer to customers", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);
      
      // Mark tokens as available
      await nft.connect(owner).markTokensAvailable([1, 2, 3, 4]);
      
      // Batch transfer
      await nft.connect(owner).batchTransferToCustomers(
        [user1.address, user2.address], 
        [1, 2]
      );
      
      // Check ownership
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.ownerOf(2)).to.equal(user2.address);
      expect(await nft.getAvailableCount()).to.equal(2);
    });

    it("Should revert when transferring unavailable token", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // Try to transfer without marking as available
      await expect(
        nft.connect(owner).transferToCustomer(user1.address, 1)
      ).to.be.revertedWith("Token not marked as available");
    });

    it("Should revert when no tokens available for next transfer", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      await expect(
        nft.connect(owner).transferNextAvailable(user1.address)
      ).to.be.revertedWith("No tokens available for sale");
    });

    it("Should revert batch transfer with mismatched arrays", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      await expect(
        nft.connect(owner).batchTransferToCustomers(
          [user1.address], 
          [1, 2] // Mismatched length
        )
      ).to.be.revertedWith("Arrays length mismatch");
    });

    it("Should revert batch transfer with too many tokens", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      const recipients = new Array(51).fill(owner.address);
      const tokenIds = Array.from({length: 51}, (_, i) => i + 1);
      
      await expect(
        nft.connect(owner).batchTransferToCustomers(recipients, tokenIds)
      ).to.be.revertedWith("Batch size too large");
    });

    it("Should not allow non-owner to transfer tokens", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);
      
      await nft.connect(owner).markTokensAvailable([1]);
      
      await expect(
        nft.connect(user1).transferToCustomer(user2.address, 1)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("Soulbound Functionality", function () {
    it("Should prevent customer transfers when soulbound is true", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);
      
      // Transfer token to customer
      await nft.connect(owner).markTokensAvailable([1]);
      await nft.connect(owner).transferToCustomer(user1.address, 1);
      
      // Customer should not be able to transfer
      await expect(
        nft.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Token is soulbound - only owner can transfer");
    });

    it("Should allow customer transfers when soulbound is false", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployTransferableFixture);
      
      // Transfer token to customer
      await nft.connect(owner).markTokensAvailable([1]);
      await nft.connect(owner).transferToCustomer(user1.address, 1);
      
      // Customer should be able to transfer
      await nft.connect(user1).transferFrom(user1.address, user2.address, 1);
      expect(await nft.ownerOf(1)).to.equal(user2.address);
    });

    it("Should allow owner transfers regardless of soulbound status", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture); // soulbound = true
      
      // Owner can still transfer
      await nft.connect(owner).markTokensAvailable([1]);
      await nft.connect(owner).transferToCustomer(user1.address, 1);
      
      expect(await nft.ownerOf(1)).to.equal(user1.address);
    });

    it("Should allow toggling soulbound status", async function () {
      const { nft, owner, user1, user2 } = await loadFixture(deployFixture);
      
      // Start soulbound
      expect(await nft.soulbound()).to.be.true;
      
      // Transfer to customer
      await nft.connect(owner).markTokensAvailable([1]);
      await nft.connect(owner).transferToCustomer(user1.address, 1);
      
      // Customer cannot transfer
      await expect(
        nft.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Token is soulbound - only owner can transfer");
      
      // Toggle soulbound off
      await nft.connect(owner).setSoulbound(false);
      expect(await nft.soulbound()).to.be.false;
      
      // Now customer can transfer
      await nft.connect(user1).transferFrom(user1.address, user2.address, 1);
      expect(await nft.ownerOf(1)).to.equal(user2.address);
    });
  });

  describe("Pausable Functionality", function () {
    it("Should prevent transfers when paused", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // Pause contract
      await nft.connect(owner).pause();
      
      // Mark token as available
      await nft.connect(owner).markTokensAvailable([1]);
      
      // Should not be able to transfer when paused
      await expect(
        nft.connect(owner).transferToCustomer(user1.address, 1)
      ).to.be.revertedWithCustomError(nft, "EnforcedPause");
    });

    it("Should allow transfers when unpaused", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      // Pause and unpause
      await nft.connect(owner).pause();
      await nft.connect(owner).unpause();
      
      // Should work normally
      await nft.connect(owner).markTokensAvailable([1]);
      await nft.connect(owner).transferToCustomer(user1.address, 1);
      
      expect(await nft.ownerOf(1)).to.equal(user1.address);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update base URI", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      const newBaseURI = "https://new.api.blockus.com/metadata/";
      
      // Update base URI
      await nft.connect(owner).setBaseURI(newBaseURI);
      
      // Check the token URI (token 1 should exist)
      expect(await nft.tokenURI(1)).to.equal(newBaseURI + "1");
    });

    it("Should allow owner to update soulbound status", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      // Update soulbound status
      await nft.connect(owner).setSoulbound(false);
      
      // Check the updated status
      expect(await nft.soulbound()).to.be.false;
    });

    it("Should not allow non-owner to update settings", async function () {
      const { nft, user1 } = await loadFixture(deployFixture);
      
      await expect(
        nft.connect(user1).setBaseURI("https://hack.com/")
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
      
      await expect(
        nft.connect(user1).setSoulbound(false)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
      
      await expect(
        nft.connect(user1).pause()
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("Events", function () {
    it("Should emit TokenMinted events during deployment", async function () {
      const [owner, trustedForwarder] = await hre.ethers.getSigners();
      const BlockusPremint = await hre.ethers.getContractFactory("BlockusPremint");
      
      // Deploy the contract and wait for it
      const nft = await BlockusPremint.deploy(
        "Test NFT",
        "TEST",
        "https://test.com/",
        owner.address,
        trustedForwarder.address,
        false,
        3 // Small number for testing
      );
      
      // Get the deployment transaction receipt
      const deploymentTx = nft.deploymentTransaction();
      const receipt = await deploymentTx?.wait();
      
      // Parse events from the receipt
      const events = receipt?.logs?.map(log => {
        try {
          return nft.interface.parseLog({ topics: log.topics as string[], data: log.data });
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
      
      // Check that TokenMinted events were emitted
      const tokenMintedEvents = events?.filter(event => event?.name === "TokenMinted");
      expect(tokenMintedEvents).to.have.length(3);
      
      // Check first token minted event
      expect(tokenMintedEvents?.[0]?.args?.to).to.equal(owner.address);
      expect(tokenMintedEvents?.[0]?.args?.tokenId).to.equal(1);
    });

    it("Should emit TokenSold event on transfer", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      
      await nft.connect(owner).markTokensAvailable([1]);
      
      await expect(nft.connect(owner).transferToCustomer(user1.address, 1))
        .to.emit(nft, "TokenSold")
        .withArgs(user1.address, 1);
    });

    it("Should emit TokensMarkedAvailable event", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      await expect(nft.connect(owner).markTokensAvailable([1, 2, 3]))
        .to.emit(nft, "TokensMarkedAvailable")
        .withArgs([1, 2, 3]);
    });

    it("Should emit BaseURIUpdated event", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      
      const newURI = "https://new.test.com/";
      await expect(nft.connect(owner).setBaseURI(newURI))
        .to.emit(nft, "BaseURIUpdated")
        .withArgs(newURI);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle token URI correctly", async function () {
      const { nft, baseURI } = await loadFixture(deployFixture);
      
      // Check token URI for preminted tokens
      expect(await nft.tokenURI(1)).to.equal(baseURI + "1");
      expect(await nft.tokenURI(50)).to.equal(baseURI + "50");
    });

    it("Should handle ERC721Enumerable functions", async function () {
      const { nft, owner, totalSupply } = await loadFixture(deployFixture);
      
      // Check token by index
      expect(await nft.tokenOfOwnerByIndex(owner.address, 0)).to.equal(1);
      expect(await nft.tokenOfOwnerByIndex(owner.address, totalSupply - 1)).to.equal(totalSupply);
      
      // Check token by global index
      expect(await nft.tokenByIndex(0)).to.equal(1);
      expect(await nft.tokenByIndex(totalSupply - 1)).to.equal(totalSupply);
    });

    it("Should support correct interfaces", async function () {
      const { nft } = await loadFixture(deployFixture);
      
      // ERC721
      expect(await nft.supportsInterface("0x80ac58cd")).to.be.true;
      // ERC721Enumerable  
      expect(await nft.supportsInterface("0x780e9d63")).to.be.true;
    });
  });
});