const router    = require("express").Router();
const c         = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");

/* public — admin login + seed (seed only for first-time setup) */
router.post("/auth/login", c.login);
router.post("/auth/seed",  c.seedAdmin);   // remove in production

/* protected */
router.use(adminAuth);
router.get("/stats",                    c.getStats);
router.get("/dashboard",                c.getDashboard);
router.get("/users",                    c.getUsers);
router.post("/users",                   c.createUser);
router.get("/users/:id",                c.getUser);
router.put("/users/:id/subscription",   c.updateSubscription);
router.post("/users/:id/suspend",       c.suspendUser);
router.post("/users/:id/activate",      c.activateUser);
router.get("/users/:id/logs",           c.getUserLogs);

module.exports = router;
