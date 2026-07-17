import { Request, Response } from "express";
import {LambdaClient, InvokeCommand} from "@aws-sdk/client-lambda";
/**
 * Controller responsible for handling
 * payment-related HTTP requests.
 */
export class PaymentController {

    private readonly lambdaClient =
        new LambdaClient({
            region: "us-east-1"
        });
/**
 * Receives a payment request and invokes the
 * AWS Lambda responsible for processing it.
 * @param req Express HTTP request
 * @param res Express HTTP response.
 */
    async registerPayment(
        req: Request,
        res: Response
    ): Promise<void> {

        try {

            const payload = {
                body: JSON.stringify(req.body)
            };

            console.log("Payload enviado:");

            console.log(
                JSON.stringify(payload, null, 2)
            );

            const response =
                await this.lambdaClient.send(
                    new InvokeCommand({
                        FunctionName:
                            "practica-aws-dev-registerPayment",
                        Payload: Buffer.from(
                            JSON.stringify(payload)
                        )
                    })
                );

            console.log("Respuesta Lambda:");

            console.log(
                response.Payload
                    ? Buffer
                          .from(response.Payload)
                          .toString()
                    : "Sin respuesta"
            );

            const result = response.Payload
                ? JSON.parse(
                      Buffer
                          .from(response.Payload)
                          .toString()
                  )
                : null;

            res.status(200).json(result);

        } catch (error: any) {

            console.error(error);

            res.status(500).json({
                error: error.message
            });

        }

    }

}