# Fluree NodeJS Listener Example

## About

This repo is meant to demonstrate how [Fluree's NodeJS library](https://docs.flur.ee/tools/1.0.0/nodejs/nodejs-examples) can be used as a data-event-driven sidecar to a Fluree ledger.

Because Fluree's database engine (e.g. queries/reads) is decoupled from its ledger engine (e.g. transactions/writes), database peers are enabled by a data-eventing architecture where the ledger pushes relevant index data or block-event data to subscribed peers. This enables those services to operate as either (a) ephemeral, horizontally-scalable, fully-functional database servers or (b) event-driven machine services to execute whatever arbitrary logic fits your use case.

This repo demonstrates capability (b) described above, and we will...

1. Use the [Fluree's NodeJS library](https://docs.flur.ee/tools/1.0.0/nodejs/nodejs-examples) to subscribe/connect a db peer to a ledger
2. Receive data event updates from that ledger for each new block committed
3. Evaluate those diffs in data for events that conform to our particular interest & criteria
4. Execute whatever logic we want to trigger as a result of this data concern (e.g. insert or update additional Fluree data; push a message to a Kafka topic; trigger an AWS Lambda Function; etc. etc.)

In this specific (albeit arbitrary) example, we will be monitoring ledger-provided data events for blocks that describe net-new `_user/username` values. That is, we will look for events where a `_user/username` value is inserted for the first time (as opposed to when a username is deleted or updated). On each occurrence of this data event criteria, our machine service will initialize a new ledger specific to this `_user/username` (for example, if a \_user is added with `_user/username: "ajohnson"`, we will add a ledger named `user/ajohnson`, etc.).

Please refer to more detailed comments within the repo's code for specific information such as...

- how the `flureenjs.connect()` method establishes a persistent connection to the ledger
- how the `flureenjs.listener()` method is invoked
- how individual data events are evaluated for conformity to relevant use case criteria
- how the machine service proceeds with its logic after evaluating matching event criteria

> NOTE: For the purpose of making this example as simple as possible, the code is entirely designed to function against a brand-new ledger without needing to add schema or seed data. A clearer, more robust use case within, say, a product/inventory management data model might use the same pattern documented in this repo to monitor any insertions or updates for `product/SKU` values, and then fetch associated image URLs for that SKU in order to update a separate predicate like `product/imageURLs` on the same subject.

## Getting Started

1. Make sure that you have a Fluree instance running and available by public URL
   > NOTE: This example requires Fluree v1.0.0-beta14 or higher. You can [download the latest version of Fluree here](https://s3.amazonaws.com/fluree-releases-public/fluree-latest.zip) (i.e. v1.0.0-beta15 as of the release of this example).
2. If you are not running Fluree locally behind `localhost:8090`, update the value for `flureeURL` on line :4 of `app.js` to reflect the host/IP & port of your Fluree instance.
3. From the root of this project, run `npm install && node app.js`

You should see something like the following log output in your terminal:

```
Connecting to Fluree instance @ http://localhost:8090
Connection Established!
```

If your Fluree instance does not yet have a ledger named `listener/example`, the `app.js` code will initialize this new ledger and then begin listening for all new data events emitted by `listener/example`.

You should now be able to issue various transactions against `listener/example`. Irrelevant data events, such as inserting a new `_collection`, will not trigger the NodeJS app's logic. Relevant data events, which insert a new `_user` with a `_user/username` value, will be evaluated by the listener's callback function and will prompt the creation of a new ledger namespaced for that particular user.

An example of an irrelevant transaction that will not trigger the data-event-driven machine service:

```
[
  {
      "_id": "_collection",
      "name": "foobar"
  }
]
```

An example of a relevant transaction that will trigger the data-event-driven machine service (i.e. that will add a new ledger)

```
[
  {
      "_id": "_user",
      "username": "freddyTheYeti"
  }
]
```
