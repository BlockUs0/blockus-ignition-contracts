import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeployBlockus721FactoryModule = buildModule("DeployBlockus721FactoryModule", (m) => {
  
  const initialOwner = m.getParameter("initialOwner", "0xFB712f6712E701dc09F50E6373F230780a84eD7b");
  const trustedForwarder = m.getParameter("trustedForwarder", "0x593b7bdafe274a16bbf9ea266367829b38bafc96");
  const deploymentFee = m.getParameter("deploymentFee", 0); // Default deployment fee to 0

  console.log({
    initialOwner,
    trustedForwarder,
    deploymentFee
  });

  // Deploy the Blockus721Factory contract
  const blockus721Factory = m.contract("Blockus721Factory", [
    initialOwner,
    trustedForwarder,
    deploymentFee
  ]);

  return { blockus721Factory };
});

export default DeployBlockus721FactoryModule;