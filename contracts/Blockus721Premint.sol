// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title Blockus721Premint
 * @dev Premint ERC721 with soulbound capability and meta transactions
 */
contract BlockusPremint is ERC721, ERC721Enumerable, Ownable, Pausable, ERC2771Context {
    // Maximum supply of tokens
    uint256 public immutable TOTAL_SUPPLY;
    
    // Base URI for token metadata
    string private _baseTokenURI;
    
    // Whether tokens are soulbound (non-transferable)
    bool public soulbound;
    
    // Current token ID counter
    uint256 private _currentTokenId;
    
    // Track available tokens for sale
    uint256[] public availableTokens;
    mapping(uint256 => bool) public isAvailable;

    // Events
    event TokenMinted(address indexed to, uint256 indexed tokenId);
    event TokenSold(address indexed to, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);
    event TokensMarkedAvailable(uint256[] tokenIds);

    /**
     * @dev Constructor
     * @param name_ Collection name
     * @param symbol_ Collection symbol
     * @param baseURI_ Base URI for token metadata
     * @param initialOwner Address of the initial owner
     * @param trustedForwarder Address of the trusted forwarder for meta transactions
     * @param isSoulbound Whether tokens are soulbound (non-transferable)
     * @param totalSupply_ Total number of tokens to premint
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address initialOwner,
        address trustedForwarder,
        bool isSoulbound,
        uint256 totalSupply_
    ) ERC721(name_, symbol_) Ownable(initialOwner) ERC2771Context(trustedForwarder) {
        require(totalSupply_ > 0, "Total supply must be greater than 0");
        require(totalSupply_ <= 10000, "Total supply too large");
        
        _baseTokenURI = baseURI_;
        soulbound = isSoulbound;
        TOTAL_SUPPLY = totalSupply_;
        
        // Premint all NFTs to the owner
        _premintAll(initialOwner);
    }

    /**
     * @dev Premint all tokens to the initial owner
     * @param to Address to mint all tokens to
     */
    function _premintAll(address to) internal {
        for (uint256 i = 1; i <= TOTAL_SUPPLY; i++) {
            _safeMint(to, i);
            emit TokenMinted(to, i);
        }
        _currentTokenId = TOTAL_SUPPLY;
    }

    /**
     * @dev Mark tokens as available for sale
     * @param tokenIds Array of token IDs to mark as available
     */
    function markTokensAvailable(uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(tokenId > 0 && tokenId <= TOTAL_SUPPLY, "Invalid token ID");
            require(ownerOf(tokenId) == owner(), "Token not owned by contract owner");
            require(!isAvailable[tokenId], "Token already marked as available");
            
            availableTokens.push(tokenId);
            isAvailable[tokenId] = true;
        }
        
        emit TokensMarkedAvailable(tokenIds);
    }

    /**
     * @dev Mark all owned tokens as available for sale
     */
    function markAllOwnedTokensAvailable() external onlyOwner {
        uint256[] memory ownedTokens = new uint256[](balanceOf(owner()));
        uint256 index = 0;
        
        for (uint256 i = 1; i <= TOTAL_SUPPLY; i++) {
            if (ownerOf(i) == owner() && !isAvailable[i]) {
                ownedTokens[index] = i;
                availableTokens.push(i);
                isAvailable[i] = true;
                index++;
            }
        }
        
        // Resize array to actual length
        uint256[] memory actualTokens = new uint256[](index);
        for (uint256 j = 0; j < index; j++) {
            actualTokens[j] = ownedTokens[j];
        }
        
        emit TokensMarkedAvailable(actualTokens);
    }

    /**
     * @dev Transfer a token to a customer (for sales)
     * @param to Recipient address
     * @param tokenId Specific token ID to transfer
     */
    function transferToCustomer(address to, uint256 tokenId) external onlyOwner whenNotPaused {
        require(ownerOf(tokenId) == owner(), "Token not owned by contract owner");
        require(isAvailable[tokenId], "Token not marked as available");
        
        // Remove from available tokens
        _removeFromAvailable(tokenId);
        
        // Transfer the token
        safeTransferFrom(owner(), to, tokenId);
        
        emit TokenSold(to, tokenId);
    }

    /**
     * @dev Transfer next available token to customer
     * @param to Recipient address
     * @return The ID of the transferred token
     */
    function transferNextAvailable(address to) external onlyOwner whenNotPaused returns (uint256) {
        require(availableTokens.length > 0, "No tokens available for sale");
        
        // Get the last token from available tokens (LIFO)
        uint256 tokenId = availableTokens[availableTokens.length - 1];
        availableTokens.pop();
        isAvailable[tokenId] = false;
        
        // Transfer the token
        safeTransferFrom(owner(), to, tokenId);
        
        emit TokenSold(to, tokenId);
        
        return tokenId;
    }

    /**
     * @dev Batch transfer multiple tokens to customers
     * @param recipients Array of recipient addresses
     * @param tokenIds Array of token IDs to transfer
     */
    function batchTransferToCustomers(
        address[] calldata recipients, 
        uint256[] calldata tokenIds
    ) external onlyOwner whenNotPaused {
        require(recipients.length == tokenIds.length, "Arrays length mismatch");
        require(recipients.length <= 50, "Batch size too large");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(ownerOf(tokenIds[i]) == owner(), "Token not owned by contract owner");
            require(isAvailable[tokenIds[i]], "Token not marked as available");
            
            _removeFromAvailable(tokenIds[i]);
            safeTransferFrom(owner(), recipients[i], tokenIds[i]);
            
            emit TokenSold(recipients[i], tokenIds[i]);
        }
    }

    /**
     * @dev Remove token from available tokens array
     * @param tokenId Token ID to remove
     */
    function _removeFromAvailable(uint256 tokenId) internal {
        isAvailable[tokenId] = false;
        
        // Find and remove token from array
        for (uint256 i = 0; i < availableTokens.length; i++) {
            if (availableTokens[i] == tokenId) {
                availableTokens[i] = availableTokens[availableTokens.length - 1];
                availableTokens.pop();
                break;
            }
        }
    }

    /**
     * @dev Get all available token IDs
     * @return Array of available token IDs
     */
    function getAvailableTokens() external view returns (uint256[] memory) {
        return availableTokens;
    }

    /**
     * @dev Get number of available tokens
     * @return Number of tokens available for sale
     */
    function getAvailableCount() external view returns (uint256) {
        return availableTokens.length;
    }

    /**
     * @dev Sets the base URI for token metadata
     * @param newBaseURI New base URI
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @dev Sets whether tokens are soulbound
     * @param isSoulbound Whether tokens are soulbound
     */
    function setSoulbound(bool isSoulbound) external onlyOwner {
        soulbound = isSoulbound;
    }

    /**
     * @dev Pauses all token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Base URI for computing {tokenURI}
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Hook that is called before any token transfer
     */
    function _update(address from, uint256 tokenId, address to) internal virtual override(ERC721, ERC721Enumerable) whenNotPaused returns (address) {
        // Allow minting (from = address(0))
        // Allow burning (to = address(0)) 
        if (from != address(0) && to != address(0) && soulbound) {
            // If soulbound is enabled, only allow transfers FROM the owner (initial sales)
            // OR if the transaction is initiated by the owner (for admin transfers)
            require(
                from == owner() || _msgSender() == owner(), 
                "Token is soulbound - only owner can transfer"
            );
        }
        
        return super._update(from, tokenId, to);
    }
    
    /**
     * @dev Override for _increaseBalance to implement ERC721Enumerable
     */
    function _increaseBalance(address account, uint128 value) internal virtual override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    /**
     * @dev Override for ERC2771Context's _msgSender() function
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    /**
     * @dev Override for ERC2771Context's _msgData() function
     */
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    
    /**
     * @dev Override for _contextSuffixLength to resolve conflict between Context and ERC2771Context
     */
    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    /**
     * @dev Required override to support ERC721Enumerable
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}