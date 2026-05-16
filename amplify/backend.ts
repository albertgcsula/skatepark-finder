import { defineBackend } from '@aws-amplify/backend'
import { CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2'
import { auth } from './auth/resource'
import { data } from './data/resource'

const backend = defineBackend({
  auth,
  data,
})

// Rate-limit anonymous Recommendation submissions (and any other AppSync
// traffic from a given IP). 100 requests / 5 min / IP — WAF's minimum
// evaluation window is 5 minutes. The form is the only public mutation, so a
// global per-IP cap is sufficient without per-operation filtering.
const apiStack = backend.data.resources.graphqlApi.stack
const webAcl = new CfnWebACL(apiStack, 'AppSyncRateLimitWebAcl', {
  defaultAction: { allow: {} },
  scope: 'REGIONAL',
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: 'AppSyncRateLimit',
    sampledRequestsEnabled: true,
  },
  rules: [
    {
      name: 'RateLimitPerIP',
      priority: 0,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: 100,
          aggregateKeyType: 'IP',
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitPerIP',
        sampledRequestsEnabled: true,
      },
    },
  ],
})

new CfnWebACLAssociation(apiStack, 'AppSyncWebAclAssociation', {
  resourceArn: backend.data.resources.graphqlApi.arn,
  webAclArn: webAcl.attrArn,
})
