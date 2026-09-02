const router  = require("express").Router();
const auth    = require("../middleware/auth");
const subCheck = require("../middleware/subscriptionCheck");
const c       = require("../controllers/accountController");

router.use(auth);
router.use(subCheck);

router.get("/",                     c.list);
router.post("/",                    c.create);
router.get("/activity",             c.recentActivity);   // before /:id
router.put("/:id",                  c.update);
router.delete("/:id",               c.remove);
router.post("/transfer",            c.transfer);
router.post("/:id/adjust",          c.adjustBalance);
router.patch("/:id/archive",        c.toggleArchive);
router.get("/:id/transactions",     c.getTransactions);

module.exports = router;
