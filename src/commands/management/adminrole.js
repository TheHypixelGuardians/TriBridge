// /adminrole lives on the THG community bot, which owns the shared admin role
// list. Kept as a deleted stub so the startup sync unregisters the bridge's old
// /adminrole from Discord, rather than leaving a dead command beside the real one.
module.exports = {
  name: "adminrole",
  description: "Moved to the community bot.",
  deleted: true,
  callback: async () => {},
};
