import {handler}from "../src/infrastructure/inputs/lambdas/lambda.handler";
import { APIGatewayProxyEvent } from "aws-lambda";

async function runTest(){
    console.log("---Iniciando prueba del servicio de pagos---");

    //Simulamos un evento que vendria de API GetWay
    const mockEvent = {
        body: JSON.stringify({
            id: "TX-12345",
            accountId: "ACC-998877",
            amount: -500.50
    })
    }as APIGatewayProxyEvent;

    const response =await handler(mockEvent as APIGatewayProxyEvent);
    console.log("Respuesta del servicio:", response);
}

runTest();