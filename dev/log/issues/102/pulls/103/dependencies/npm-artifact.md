# npm-artifact: registry snapshot 2026-11-06 UTC

Every lock location and its consumer constraints are in the matching CSV.

| Dependency | Before | Registry latest | Resolved | Reason for retained version / removal |
| --- | --- | --- | --- | --- |
| @actions/artifact | 6.3.1 | 6.3.1 | 6.3.1 | Current registry release |
| @actions/core | 3.0.1 | 3.0.1 | 3.0.1 | Current registry release |
| @actions/exec | 3.0.0 | 3.0.0 | 3.0.0 | Current registry release |
| @actions/github | 9.1.1 | 9.1.1 | 9.1.1 | Current registry release |
| @actions/glob | 0.7.0 | 0.7.0 | 0.7.0 | Current registry release |
| @actions/http-client | 3.0.2, 4.0.1 | 4.0.1 | 3.0.2, 4.0.1 | Upstream consumer API/range constraint: @actions/github@9.1.1: ^3.0.2; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| @actions/io | 3.0.2 | 3.0.2 | 3.0.2 | Current registry release |
| @azure/abort-controller | 2.2.0 | 2.2.0 | 2.2.0 | Current registry release |
| @azure/core-auth | 1.11.0 | 1.11.0 | 1.11.0 | Current registry release |
| @azure/core-client | 1.11.1 | 1.11.1 | 1.11.1 | Current registry release |
| @azure/core-http-compat | 2.5.0 | 2.5.0 | 2.5.0 | Current registry release |
| @azure/core-lro | 2.7.2 | 3.4.1 | 2.7.2 | Upstream consumer API/range constraint: @azure/storage-blob@12.34.0: ^2.2.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| @azure/core-paging | 1.7.0 | 1.7.0 | 1.7.0 | Current registry release |
| @azure/core-rest-pipeline | 1.25.0 | 1.25.0 | 1.25.0 | Current registry release |
| @azure/core-tracing | 1.4.0 | 1.4.0 | 1.4.0 | Current registry release |
| @azure/core-util | 1.14.0 | 1.14.0 | 1.14.0 | Current registry release |
| @azure/core-xml | 1.6.0 | 1.6.0 | 1.6.0 | Current registry release |
| @azure/logger | 1.4.0 | 1.4.0 | 1.4.0 | Current registry release |
| @azure/storage-blob | 12.34.0 | 12.34.0 | 12.34.0 | Current registry release |
| @azure/storage-common | 12.5.0 | 12.5.0 | 12.5.0 | Current registry release |
| @isaacs/nonrecursive-glob-match | 1.0.3 | 1.1.0 | 1.1.0 | Current registry release |
| @nodable/entities | 3.1.0 | 3.1.0 | 3.1.0 | Current registry release |
| @octokit/auth-token | 6.0.0 | 6.0.0 | 6.0.0 | Current registry release |
| @octokit/core | 7.0.8 | 7.0.8 | 7.0.8 | Current registry release |
| @octokit/endpoint | 11.0.5 | 11.0.5 | 11.0.5 | Current registry release |
| @octokit/graphql | 9.0.5 | 9.0.5 | 9.0.5 | Current registry release |
| @octokit/openapi-types | 27.0.0, 28.0.0, 29.0.1 | 29.0.1 | 27.0.0, 28.0.0, 29.0.1 | Upstream consumer API/range constraint: @octokit/types@16.0.0: ^27.0.0; Upstream consumer API/range constraint: @octokit/types@17.0.0: ^28.0.0 |
| @octokit/plugin-paginate-rest | 14.0.0 | 16.0.0 | 14.0.0 | Upstream consumer API/range constraint: @actions/github@9.1.1: ^14.0.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| @octokit/plugin-request-log | 6.0.0 | 6.0.0 | 6.0.0 | Current registry release |
| @octokit/plugin-rest-endpoint-methods | 17.0.0 | 18.0.0 | 17.0.0 | Upstream consumer API/range constraint: @actions/github@9.1.1: ^17.0.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| @octokit/plugin-retry | 8.1.1 | 8.1.1 | 8.1.1 | Current registry release |
| @octokit/request | 10.0.16 | 10.0.16 | 10.0.16 | Current registry release |
| @octokit/request-error | 7.1.2 | 7.1.2 | 7.1.2 | Current registry release |
| @octokit/types | 16.0.0, 17.0.0, 18.0.0 | 18.0.0 | 16.0.0, 17.0.0, 18.0.0 | Upstream consumer API/range constraint: @octokit/plugin-paginate-rest@14.0.0: ^16.0.0; Upstream consumer API/range constraint: @octokit/plugin-rest-endpoint-methods@17.0.0: ^16.0.0; Upstream consumer API/range constraint: @octokit/plugin-retry@8.1.1: ^17.0.0 |
| @protobuf-ts/runtime | 2.11.1 | 2.11.1 | 2.11.1 | Current registry release |
| @protobuf-ts/runtime-rpc | 2.11.1 | 2.11.1 | 2.11.1 | Current registry release |
| @types/node | 25.9.9 | 26.6.6 | 25.9.9 | Upstream consumer API/range constraint: apache-arrow@21.2.0: ^25.2.0 |
| @typespec/ts-http-runtime | 0.3.9 | 0.3.9 | 0.3.9 | Current registry release |
| @zip.js/zip.js | 2.24.0 | 2.24.0 | 2.24.0 | Current registry release |
| abort-controller | 3.0.0 | 3.0.0 | 3.0.0 | Current registry release |
| agent-base | 7.1.4 | 9.0.0 | 7.1.4 | Upstream consumer API/range constraint: http-proxy-agent@7.0.2: ^7.1.0; https-proxy-agent@7.0.6: ^7.1.2; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| anynum | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| apache-arrow | 21.2.0 | 21.2.0 | 21.2.0 | Current registry release |
| archiver | 7.0.1 | 8.0.0 | 7.0.1 | Upstream consumer API/range constraint: @actions/artifact@6.3.1: ^7.0.1; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| archiver-utils | 5.0.2 | 5.0.2 | 5.0.2 | Current registry release |
| array-buffer-byte-length | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| arraybuffer.prototype.slice | 1.0.4 | 1.0.4 | 1.0.4 | Current registry release |
| async | 3.2.6 | 3.2.6 | 3.2.6 | Current registry release |
| async-function | 1.0.0 | 1.0.0 | 1.0.0 | Current registry release |
| available-typed-arrays | 1.0.7 | 1.0.7 | 1.0.7 | Current registry release |
| b4a | 1.9.0 | 1.9.0 | 1.9.0 | Current registry release |
| balanced-match | 1.0.2, 4.0.4 | 5.0.0 | 1.0.2, 4.0.4 | Upstream consumer API/range constraint: brace-expansion@2.1.7: ^1.0.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration; Upstream consumer API/range constraint: brace-expansion@5.0.12: ^4.0.2; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| bare-buffer | new/unlocked | 3.7.1 | 3.7.1 | Current registry release |
| bare-events | 2.9.2 | 2.9.2 | 2.9.2 | Current registry release |
| bare-fs | 4.8.4 | 4.8.4 | 4.8.4 | Current registry release |
| bare-path | 3.1.2 | 3.1.2 | 3.1.2 | Current registry release |
| bare-stream | 2.13.4 | 2.13.4 | 2.13.4 | Current registry release |
| bare-url | 2.5.5 | 2.5.6 | 2.5.6 | Current registry release |
| base64-js | 1.5.1 | 1.5.1 | 1.5.1 | Current registry release |
| before-after-hook | 4.0.0 | 4.0.0 | 4.0.0 | Current registry release |
| binary | 0.3.0 | 0.3.0 | 0.3.0 | Current registry release |
| bottleneck | 2.19.5 | 2.19.5 | 2.19.5 | Current registry release |
| brace-expansion | 2.1.7, 5.0.12 | 5.0.12 | 2.1.7, 5.0.12 | Upstream consumer API/range constraint: minimatch@5.1.9: ^2.0.1; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| buffer | 6.0.3 | 6.0.3 | 6.0.3 | Current registry release |
| buffer-crc32 | 1.0.0 | 1.0.0 | 1.0.0 | Current registry release |
| buffers | 0.1.1 | 0.1.1 | 0.1.1 | Current registry release |
| call-bind | 1.0.9 | 1.0.9 | 1.0.9 | Current registry release |
| call-bind-apply-helpers | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| call-bound | 1.0.4 | 1.0.4 | 1.0.4 | Current registry release |
| chainsaw | 0.1.0 | 0.1.0 | 0.1.0 | Current registry release |
| compress-commons | 6.0.2 | 7.0.1 | 6.0.2 | Upstream consumer API/range constraint: zip-stream@6.0.1: ^6.0.2; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| content-type | 3.1.1 | 3.1.1 | 3.1.1 | Current registry release |
| core-util-is | 1.0.3 | 1.0.3 | 1.0.3 | Current registry release |
| crc-32 | 1.2.2 | 1.2.2 | 1.2.2 | Current registry release |
| crc32-stream | 6.0.0 | 7.0.1 | 6.0.0 | Upstream consumer API/range constraint: compress-commons@6.0.2: ^6.0.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| data-view-buffer | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| data-view-byte-length | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| data-view-byte-offset | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| debug | 4.4.3 | 4.4.3 | 4.4.3 | Current registry release |
| define-data-property | 1.1.4 | 1.1.4 | 1.1.4 | Current registry release |
| define-properties | 1.2.1 | 1.2.1 | 1.2.1 | Current registry release |
| dunder-proto | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| es-abstract | 1.24.2 | 1.24.2 | 1.24.2 | Current registry release |
| es-abstract-get | 1.0.0 | 1.0.0 | 1.0.0 | Current registry release |
| es-define-property | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| es-errors | 1.3.0 | 1.3.0 | 1.3.0 | Current registry release |
| es-object-atoms | 1.1.2 | 1.1.2 | 1.1.2 | Current registry release |
| es-set-tostringtag | 2.1.0 | 2.1.0 | 2.1.0 | Current registry release |
| es-to-primitive | 1.3.4 | 1.3.4 | 1.3.4 | Current registry release |
| event-target-shim | 5.0.1 | 6.0.2 | 5.0.1 | Upstream consumer API/range constraint: abort-controller@3.0.0: ^5.0.0 |
| events | 3.3.0 | 3.3.0 | 3.3.0 | Current registry release |
| events-universal | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| fast-fifo | 1.3.2 | 1.3.2 | 1.3.2 | Current registry release |
| fast-xml-builder | 1.3.1 | 1.3.1 | 1.3.1 | Current registry release |
| fast-xml-parser | 5.11.2 | 5.12.0 | 5.12.0 | Current registry release |
| flatbuffers | 25.9.23 | 25.9.23 | 25.9.23 | Current registry release |
| for-each | 0.3.5 | 0.3.5 | 0.3.5 | Current registry release |
| function-bind | 1.1.2 | 1.1.2 | 1.1.2 | Current registry release |
| function.prototype.name | 1.2.0 | 1.2.0 | 1.2.0 | Current registry release |
| functions-have-names | 1.2.3 | 1.2.3 | 1.2.3 | Current registry release |
| generator-function | 2.0.1 | 2.0.1 | 2.0.1 | Current registry release |
| get-intrinsic | 1.3.0 | 1.3.0 | 1.3.0 | Current registry release |
| get-proto | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| get-symbol-description | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| glob | 14.0.3 | 14.0.3 | 14.0.3 | Current registry release |
| globalthis | 1.0.4 | 1.0.4 | 1.0.4 | Current registry release |
| gopd | 1.2.0 | 1.2.0 | 1.2.0 | Current registry release |
| graceful-fs | 4.2.11 | 4.2.11 | 4.2.11 | Current registry release |
| has-bigints | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| has-property-descriptors | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| has-proto | 1.2.0 | 1.2.0 | 1.2.0 | Current registry release |
| has-symbols | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| has-tostringtag | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| hasown | 2.0.4 | 2.0.4 | 2.0.4 | Current registry release |
| http-proxy-agent | 7.0.2 | 9.1.0 | 7.0.2 | Upstream consumer API/range constraint: @typespec/ts-http-runtime@0.3.9: ^7.0.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| https-proxy-agent | 7.0.6 | 9.1.0 | 7.0.6 | Upstream consumer API/range constraint: @typespec/ts-http-runtime@0.3.9: ^7.0.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| ieee754 | 1.2.1 | 1.2.1 | 1.2.1 | Current registry release |
| inherits | 2.0.4 | 2.0.4 | 2.0.4 | Current registry release |
| internal-slot | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| is-array-buffer | 3.0.5 | 3.0.5 | 3.0.5 | Current registry release |
| is-async-function | 2.1.1 | 2.1.1 | 2.1.1 | Current registry release |
| is-bigint | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| is-boolean-object | 1.2.2 | 1.2.2 | 1.2.2 | Current registry release |
| is-callable | 1.2.7 | 1.2.7 | 1.2.7 | Current registry release |
| is-data-view | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| is-date-object | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| is-document.all | 1.0.0 | 1.0.0 | 1.0.0 | Current registry release |
| is-finalizationregistry | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| is-generator-function | 1.1.2 | 1.1.2 | 1.1.2 | Current registry release |
| is-map | 2.0.3 | 2.0.3 | 2.0.3 | Current registry release |
| is-negative-zero | 2.0.3 | 2.0.3 | 2.0.3 | Current registry release |
| is-number-object | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| is-regex | 1.2.1 | 1.2.1 | 1.2.1 | Current registry release |
| is-set | 2.0.3 | 2.0.3 | 2.0.3 | Current registry release |
| is-shared-array-buffer | 1.0.4 | 1.0.4 | 1.0.4 | Current registry release |
| is-stream | 2.0.1 | 4.0.1 | 2.0.1 | Upstream consumer API/range constraint: archiver-utils@5.0.2: ^2.0.1; compress-commons@6.0.2: ^2.0.1; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| is-string | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| is-symbol | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| is-typed-array | 1.1.15 | 1.1.15 | 1.1.15 | Current registry release |
| is-unsafe | 2.0.2 | 2.0.3 | 2.0.3 | Current registry release |
| is-weakmap | 2.0.2 | 2.0.2 | 2.0.2 | Current registry release |
| is-weakref | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| is-weakset | 2.0.4 | 2.0.4 | 2.0.4 | Current registry release |
| isarray | 1.0.0, 2.0.5 | 2.0.5 | 1.0.0, 2.0.5 | Upstream consumer API/range constraint: readable-stream@2.3.8: ~1.0.0 |
| json-with-bigint | 3.5.12 | 3.5.12 | 3.5.12 | Current registry release |
| jwt-decode | 4.0.0 | 4.0.0 | 4.0.0 | Current registry release |
| lazystream | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| lodash | 4.18.1 | 4.18.1 | 4.18.1 | Current registry release |
| lru-cache | 11.5.3 | 11.5.3 | 11.5.3 | Current registry release |
| math-intrinsics | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| minimatch | 11.0.4, 5.1.9, new/unlocked | 11.0.5 | 11.0.5, 5.1.9, removed/hoisted | Fresh resolution removed this location; no direct feature or manifest dependency was removed; Upstream consumer API/range constraint: readdir-glob@1.1.3: ^5.1.0; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
| minimist | 1.2.8 | 1.2.8 | 1.2.8 | Current registry release |
| minipass | 7.1.3 | 7.1.3 | 7.1.3 | Current registry release |
| mkdirp | 0.5.6 | 3.0.1 | 0.5.6 | Upstream consumer API/range constraint: unzip-stream@0.3.4: ^0.5.1 |
| ms | 2.1.3 | 2.1.3 | 2.1.3 | Current registry release |
| normalize-path | 3.0.0 | 3.0.0 | 3.0.0 | Current registry release |
| object-inspect | 1.13.4 | 1.13.4 | 1.13.4 | Current registry release |
| object-keys | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| object.assign | 4.1.7 | 4.1.7 | 4.1.7 | Current registry release |
| own-keys | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| path-expression-matcher | 1.6.2 | 1.6.2 | 1.6.2 | Current registry release |
| path-scurry | 3.0.0 | 3.0.0 | 3.0.0 | Current registry release |
| possible-typed-array-names | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| process | 0.11.10 | 0.11.10 | 0.11.10 | Current registry release |
| process-nextick-args | 2.0.1 | 2.0.1 | 2.0.1 | Current registry release |
| readable-stream | 2.3.8, 4.8.0 | 4.8.0 | 2.3.8, 4.8.0 | Upstream consumer API/range constraint: lazystream@1.0.1: ^2.0.5 |
| readdir-glob | 1.1.3 | 3.0.0 | 1.1.3 | Upstream consumer API/range constraint: archiver@7.0.1: ^1.1.2 |
| reflect.getprototypeof | 1.0.10 | 1.0.10 | 1.0.10 | Current registry release |
| regexp.prototype.flags | 1.5.4 | 1.5.4 | 1.5.4 | Current registry release |
| safe-array-concat | 1.1.4 | 1.1.4 | 1.1.4 | Current registry release |
| safe-buffer | 5.1.2, 5.2.1 | 5.2.1 | 5.1.2, 5.2.1 | Upstream consumer API/range constraint: readable-stream@2.3.8: ~5.1.1; string_decoder@1.1.1: ~5.1.0 |
| safe-push-apply | 1.0.0 | 1.0.0 | 1.0.0 | Current registry release |
| safe-regex-test | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| set-function-length | 1.2.2 | 1.2.2 | 1.2.2 | Current registry release |
| set-function-name | 2.0.2 | 2.0.2 | 2.0.2 | Current registry release |
| set-proto | 1.0.0 | 1.0.0 | 1.0.0 | Current registry release |
| side-channel | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| side-channel-list | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| side-channel-map | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| side-channel-weakmap | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| stop-iteration-iterator | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| streamx | 2.28.1 | 2.28.1 | 2.28.1 | Current registry release |
| string.prototype.trim | 1.2.11 | 1.2.11 | 1.2.11 | Current registry release |
| string.prototype.trimend | 1.0.10 | 1.0.10 | 1.0.10 | Current registry release |
| string.prototype.trimstart | 1.0.8 | 1.0.8 | 1.0.8 | Current registry release |
| string_decoder | 1.1.1, 1.3.0 | 1.3.0 | 1.1.1, 1.3.0 | Upstream consumer API/range constraint: readable-stream@2.3.8: ~1.1.1 |
| strnum | 2.5.1 | 2.5.1 | 2.5.1 | Current registry release |
| tar-stream | 3.2.2 | 3.2.2 | 3.2.2 | Current registry release |
| teex | 1.0.1 | 1.0.1 | 1.0.1 | Current registry release |
| text-decoder | 1.2.7 | 1.2.7 | 1.2.7 | Current registry release |
| traverse | 0.3.10 | 0.6.14 | 0.3.10 | Upstream consumer API/range constraint: chainsaw@0.1.0: >=0.3.0 <0.4 |
| tslib | 2.8.1 | 2.9.1 | 2.9.1 | Current registry release |
| tunnel | 0.0.6 | 0.0.6 | 0.0.6 | Current registry release |
| typed-array-buffer | 1.0.3 | 1.0.3 | 1.0.3 | Current registry release |
| typed-array-byte-length | 1.0.3 | 1.0.3 | 1.0.3 | Current registry release |
| typed-array-byte-offset | 1.0.5 | 1.0.5 | 1.0.5 | Current registry release |
| typed-array-length | 1.0.8 | 1.0.8 | 1.0.8 | Current registry release |
| typedarray.prototype.slice | 1.0.6 | 1.0.6 | 1.0.6 | Current registry release |
| unbox-primitive | 1.1.0 | 1.1.0 | 1.1.0 | Current registry release |
| undici | 6.29.1 | 8.12.4 | 6.29.1 | Upstream consumer API/range constraint: @actions/github@9.1.1: ^6.23.0; @actions/http-client@3.0.2: ^6.23.0; @actions/http-client@4.0.1: ^6.23.0 |
| undici-types | 7.24.6 | 8.12.4 | 7.24.6 | Upstream consumer API/range constraint: @types/node@25.9.9: >=7.24.0 <7.24.7 |
| universal-user-agent | 7.0.3 | 7.0.3 | 7.0.3 | Current registry release |
| unzip-stream | 0.3.4 | 0.3.4 | 0.3.4 | Current registry release |
| util-deprecate | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| which-boxed-primitive | 1.1.1 | 1.1.1 | 1.1.1 | Current registry release |
| which-builtin-type | 1.2.1 | 1.2.1 | 1.2.1 | Current registry release |
| which-collection | 1.0.2 | 1.0.2 | 1.0.2 | Current registry release |
| which-typed-array | 1.1.24 | 1.1.24 | 1.1.24 | Current registry release |
| xml-naming | 0.3.0 | 0.3.0 | 0.3.0 | Current registry release |
| zip-stream | 6.0.1 | 7.0.5 | 6.0.1 | Upstream consumer API/range constraint: archiver@7.0.1: ^6.0.1; latest also changes the module/API major; a forced override would bypass the consumer's declared integration |
