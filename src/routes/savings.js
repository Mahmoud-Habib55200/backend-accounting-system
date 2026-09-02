const router   = require("express").Router();
const c        = require("../controllers/savingsController");
const auth     = require("../middleware/auth");
const subCheck = require("../middleware/subscriptionCheck");

router.use(auth);
router.use(subCheck);

router.route("/").get(c.getAll).post(c.create);
router.route("/:id").get(c.getOne).put(c.update).delete(c.remove);
router.post("/:id/deposit",      c.deposit);
router.post("/:id/withdraw",     c.withdraw);
router.post("/:id/complete",     c.complete);
router.post("/:id/archive",      c.archive);
router.get( "/:id/transactions", c.getTransactions);

module.exports = router;
