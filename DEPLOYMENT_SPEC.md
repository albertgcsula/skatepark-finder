    # Deployment Specification: AWS SSR Infrastructure (Amplify Gen 2)

    ## Overview
    To meet the **SEO requirements** and support the advanced **Technical Roadmap**, this application uses **AWS Amplify Gen 2**. Unlike legacy versions, Gen 2 is built directly on the **AWS CDK**, providing a code-first approach to infrastructure.

    ---

    ## Primary Path: AWS Amplify Gen 2 (Managed SSR + CDK)

    Amplify Gen 2 is the recommended deployment target. It natively supports the SSR capabilities of TanStack Start/Nitro and allows for seamless extension via the AWS CDK.

    ### 1. Code-First Infrastructure (CDK)
    Amplify Gen 2 uses TypeScript to define backend resources. This aligns with our **IaC (Infrastructure as Code) Contract**.
    - **Auth:** Defined via `amplify/auth/resource.ts`.
    - **Data:** Defined via `amplify/data/resource.ts` (DynamoDB + AppSync).
    - **Custom Resources:** Any AWS resource not covered by Amplify primitives can be added using standard **AWS CDK** constructs in `amplify/backend.ts`.

    ### 2. Benefits for the Roadmap
    - **Custom CDK "Escape Hatches":** We can add the **Amazon OpenSearch** cluster (for semantic search) or specialized **Lambda triggers** (for geohashing) directly into the Amplify stack.
    - **SSR Optimization:** Amplify automatically provisions the necessary Lambda and CloudFront resources to serve the Nitro server with high performance.
    - **Branch Environments:** Create full-stack "Sandbox" environments for every feature branch to test backend changes safely.

    ### 3. Deployment Workflow
    1. **Initialize:** `npx ampx init` to set up the Gen 2 structure.
    2. **Configure Build:** Update `amplify.yml` to run `npm run build`.
    3. **CI/CD:** Connect the GitHub repository to the Amplify Console. Every push triggers a CDK deployment of both the frontend SSR and the backend resources.

    ---

    ## Implementation Note: The "Escape Hatch"
    To add advanced resources like OpenSearch as specified in the `BACKEND_SPEC.md`:
    ```typescript
    // amplify/backend.ts
    import { defineBackend } from '@aws-amplify/backend';
    import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';

    const backend = defineBackend({ /* primitives */ });

    const customStack = backend.createStack('AdvancedSearchStack');
    new opensearch.Domain(customStack, 'SkateparkSearch', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
    });
    ```

    ---

    ## Summary of SEO & Technical Architecture
    - **Rendering:** Server-Side (SSR) for initial SEO-friendly requests.
    - **Backend:** Managed via Amplify Gen 2, built on **AWS CDK**.
    - **Observability:** Integrated with CloudWatch and X-Ray via standard CDK props.

