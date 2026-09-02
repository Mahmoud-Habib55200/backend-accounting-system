const router = require("express").Router();
const c    = require("../controllers/debtController");
const auth = require("../middleware/auth");

router.use(auth);

router.route("/").get(c.getAll).post(c.create);
router.route("/:id").get(c.getOne).put(c.update).delete(c.remove);
router.patch("/:id/paid",         c.markPaid);
router.route("/:id/payments").get(c.getPayments).post(c.addPayment);

module.exports = router;
