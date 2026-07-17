import {Router} from "express";
import {PaymentController} from "../controllers/payment-controller";

const router = Router();
const controller = new PaymentController();

router.post(
    "/pagos/registrarDebito",
    controller.registerPayment.bind(
        controller
    )
);
export default router;