import express from "express";
import paymentRoutes from "./routes/payment-routes"

const app = express();

app.use(express.json());

app.use(paymentRoutes);

const PORT = 3000;

app.listen(PORT, () => {
    console.log(
        `Servidor ejecutándose en puerto ${PORT}` 
    );
});