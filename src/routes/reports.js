const router = require("express").Router();
const c      = require("../controllers/reportController");
const auth   = require("../middleware/auth");

router.use(auth);

/* legacy */
router.get("/summary",  c.summary);
router.get("/monthly",  c.monthly);

/* new */
router.get("/income-expenses",  c.incomeExpenses);
router.get("/categories",       c.categories);
router.get("/cash-flow",        c.cashFlow);
router.get("/savings",          c.savings);
router.get("/net-worth",        c.netWorth);
router.get("/debts",            c.debtProgress);
router.get("/habits",           c.spendingHabits);

module.exports = router;
