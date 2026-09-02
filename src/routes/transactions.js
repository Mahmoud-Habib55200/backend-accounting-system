const router = require("express").Router();
const c = require("../controllers/transactionController");
const auth = require("../middleware/auth");

router.use(auth);

router.route("/").get(c.getAll).post(c.create);
router.route("/:id").get(c.getOne).put(c.update).delete(c.remove);

module.exports = router;
