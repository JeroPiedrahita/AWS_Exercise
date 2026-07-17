# Práctica AWS - Sistema de Procesamiento de Pagos y Generación de Reportes

## Descripción

Este proyecto implementa una solución Serverless sobre AWS para el procesamiento de pagos bancarios y la generación automática de reportes diarios.

La solución fue desarrollada siguiendo principios de Arquitectura Hexagonal (Ports & Adapters), permitiendo desacoplar la lógica de negocio de las tecnologías utilizadas para almacenamiento, exposición de APIs y generación de reportes.

---

# Arquitectura

```text
                API Gateway
                     |
                     v
              Lambda Handlers
                     |
                     v
               Use Cases
                     |
                     v
                 Puertos
                     |
      --------------------------------
      |              |              |
      v              v              v
 DynamoDB       ExcelJS         Amazon S3
 Adapter        Adapter         Adapter
```

---

# Tecnologías utilizadas

- Node.js 20
- TypeScript
- AWS Lambda
- API Gateway
- DynamoDB
- Amazon S3
- Amazon EventBridge
- AWS SDK v3
- ExcelJS
- Serverless Framework v3

---

# Estructura del proyecto

```text
.
├── iac
│   ├── provider.yml
│   │
│   ├── functions
│   │   ├── register-payment.yml
│   │   ├── get-transaction.yml
│   │   └── generate-daily-report.yml
│   │
│   └── resources
│       ├── dynamodb-table.yml
│       ├── report-bucket.yml
│       └── iam.yml
│
├── src
│   ├── application
│   │   ├── process-payment-use-cases.ts
│   │   ├── get-transaction-use-case.ts
│   │   └── generate-daily-report-use-case.ts
│   │
│   ├── domain
│   │   ├── entities
│   │   │   └── Transaction.ts
│   │   │
│   │   ├── ports
│   │   │   ├── transaction-repository.ts
│   │   │   ├── report-exporter.ts
│   │   │   └── file-storage.ts
│   │   │
│   │   ├── constants
│   │   │   └── transaction-status.ts
│   │   │
│   │   └── errors
│   │       ├── base-error.ts
│   │       └── transaction-not-found-error.ts
│   │
│   └── infrastructure
│       └── adapters
│           ├── inputs
│           │   ├── lambda-handler.ts
│           │   ├── get-transaction-handler.ts
│           │   └── generate-daily-report-handler.ts
│           │
│           └── outputs
│               ├── dynamondb-transaction-adapter.ts
│               ├── excel-report-exporter.ts
│               └── s3-file-storage.ts
│
├── tests
├── package.json
├── tsconfig.json
└── serverless.yml
```

---

# Arquitectura Hexagonal

## Entidad

### Transaction

Representa la entidad principal del dominio.

```text
Transaction
├── id
├── accountId
├── amount
├── status
└── createdAt
```

---

## Puertos

### ITransactionRepository

Define la forma en que la aplicación interactúa con el almacenamiento de transacciones.

```ts
save(transaction)

getById(id)

getTransactionsBetweenDates(startDate, endDate)
```

---

### ReportExporter

Define la estrategia para exportar reportes.

```ts
export(transactions)
```

---

### FileStorage

Define el mecanismo de almacenamiento de archivos.

```ts
save(fileName, fileContent)
```

---

# Adaptadores

## DynamonDBTransactionAdapter

Implementa:

```ts
ITransactionRepository
```

Responsabilidades:

- Guardar transacciones.
- Consultar transacciones por id.
- Consultar transacciones por rango de fechas.

---

## ExcelReportExporter

Implementa:

```ts
ReportExporter
```

Responsabilidades:

- Construir un archivo Excel.
- Transformar el archivo a Buffer.

---

## S3FileStorage

Implementa:

```ts
FileStorage
```

Responsabilidades:

- Subir archivos al bucket S3.

---

# Casos de Uso

## ProcessPaymentUseCase

Procesa un débito bancario.

### Flujo

```text
Recibir información
        ↓
Crear transacción
        ↓
Guardar en DynamoDB
        ↓
Retornar resultado
```

---

## GetTransactionUseCase

Consulta una transacción específica.

### Flujo

```text
Recibir id
      ↓
Consultar repositorio
      ↓
Retornar transacción
```

---

## GenerateDailyReportUseCase

Genera un reporte diario en formato Excel.

### Flujo

```text
Calcular inicio del día
        ↓
Calcular fin del día
        ↓
Consultar transacciones
        ↓
Generar Excel
        ↓
Construir nombre del archivo
        ↓
Guardar archivo en S3
```

---

# Manejo de errores

## BaseError

Clase base para errores personalizados.

```ts
BaseError
```

Contiene:

```ts
internalMessage
userMessage
```

Ejemplo:

```text
Internal:
Transaction not found

User:
Transacción no encontrada
```

---

## TransactionNotFoundError

Representa el caso donde una transacción no existe.

```ts
throw new TransactionNotFoundError();
```

---

# Constantes del dominio

## TransactionStatus

Centraliza los estados posibles de una transacción.

```ts
TransactionStatus.PENDING

TransactionStatus.COMPLETED

TransactionStatus.FAILED
```

Evita el uso de strings mágicos dentro de la aplicación.

---

# APIs disponibles

## Registrar Débito

### Endpoint

```http
POST /pagos/registrarDebito
```

### Request

```json
{
  "id": "TX-001",
  "accountId": "ACC-001",
  "amount": 1000
}
```

### Response

```json
{
  "message": "Transaccion procesada con exito"
}
```

---

## Obtener Transacción

### Endpoint

```http
GET /pagos/{id}
```

### Ejemplo

```http
GET /pagos/TX-001
```

### Response

```json
{
  "id": "TX-001",
  "accountId": "ACC-001",
  "amount": 1000,
  "status": "COMPLETED",
  "createdAt": "2026-07-15T12:00:00.000Z"
}
```

---

# Generación diaria de reportes

La generación del reporte es automática mediante:

```text
Amazon EventBridge
        ↓
AWS Lambda
        ↓
GenerateDailyReportUseCase
        ↓
Excel
        ↓
Amazon S3
```

Configuración:

```yaml
cron(59 23 * * ? *)
```

---

# Reporte Excel

Columnas generadas:

```text
ID
ACCOUNT ID
AMOUNT
STATUS
CREATED AT
```

Nombre del archivo:

```text
reporte-YYYY-MM-DD.xlsx
```

Ejemplo:

```text
reporte-2026-07-15.xlsx
```

---

# Infraestructura como Código (IaC)

## Funciones

### registerPayment

```text
Lambda encargada de registrar débitos.
```

### getTransaction

```text
Lambda encargada de consultar transacciones.
```

### generateDailyReport

```text
Lambda encargada de generar reportes diarios.
```

---

## Recursos

### DynamoDB

```text
TransaccionesBancariasDev
```

---

### S3

```text
transacciones-reportes-303040220363
```

---

# Recursos AWS desplegados

## Lambda Functions

```text
practica-aws-dev-registerPayment

practica-aws-dev-getTransaction

practica-aws-dev-generateDailyReport
```

---

## DynamoDB Tables

```text
TransaccionesBancariasDev
```

---

## S3 Buckets

```text
transacciones-reportes-303040220363
```

---

# Comandos útiles

## Compilar

```bash
npx tsc
```

---

## Desplegar infraestructura

```bash
npx serverless deploy
```

---

## Visualizar configuración final

```bash
npx serverless print
```

---

## Generar reporte manualmente

```bash
npx serverless invoke -f generateDailyReport
```

---

## Ver logs de una Lambda

```bash
npx serverless logs -f generateDailyReport
```

---

## Ver tablas DynamoDB

```bash
aws dynamodb list-tables --region us-east-1
```

---

## Ver buckets S3

```bash
aws s3 ls
```

---

## Ver funciones Lambda

```bash
aws lambda list-functions --region us-east-1
```

---

# Principios aplicados

- Arquitectura Hexagonal
- Ports & Adapters
- Inversión de Dependencias
- Clean Architecture
- Infraestructura desacoplada
- Programación orientada a interfaces
- Manejo centralizado de errores
- Infraestructura como código
- Serverless First Design

---

# Estado actual del proyecto

### Funcionalidades implementadas

✅ Registrar débitos bancarios

✅ Consultar transacciones por id

✅ Persistir transacciones en DynamoDB

✅ Generar reportes Excel con ExcelJS

✅ Almacenar reportes en Amazon S3

✅ Ejecutar reportes automáticos con EventBridge

✅ Manejo de errores personalizados

✅ Constantes de dominio

✅ Arquitectura Hexagonal

✅ IaC modularizada mediante Serverless Framework

---

# Autor

**Jerónimo Piedrahita**

Proyecto desarrollado como práctica de:

- AWS Lambda
- API Gateway
- DynamoDB
- Amazon S3
- Amazon EventBridge
- Arquitectura Hexagonal
- TypeScript
- Serverless Framework