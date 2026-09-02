const express  = require("express");
const router   = express.Router();
const auth     = require("../middleware/auth");
const subCheck = require("../middleware/subscriptionCheck");
const ctrl     = require("../controllers/incomeController");

router.use(auth);
router.use(subCheck);

router.get("/summary", ctrl.summary);
router.get("/",        ctrl.list);
router.post("/",       ctrl.create);
router.put("/:id",     ctrl.update);
router.delete("/:id",  ctrl.remove);

module.exports = router;
