# Token Cross Chain Bridge

## Functional description:
- Swap() function: debits tokens from the user and emits event ‘swapInitialized’
- The redeem() function: calls the ecrecover function and restores the validator's address based on the hashed message and signature, if the address matches the address    specified on the bridge contract, tokens are sent to the user
- UpdateChainById() function: add a blockchain or delete by its chainId
- IncludeToken() function: add a token to transfer it to another network
- Exclude Token() function: exclude token for transmission.

## Deployed in rinkeby:
### New:
  Contracts        |                             Addresses                      |
-------------------|------------------------------------------------------------|
  Bridge           |        0x98C77D8E65E75265151FDB26C06e03e0F763aaFF          |                                            
  Token            |        0x5e8E6E7bE6faa78B7C70906E33bc624FED6f463e          |






### Old:
  Contracts        |                             Addresses                      |
-------------------|------------------------------------------------------------|
  Bridge           |        0x85a874323BE23f6ce61Cb6A5317e1Ba7cEE4ec73          |                                            
  Token            |        0x73fc67DB44dc01467F93E94B86425944D1503F45          |
