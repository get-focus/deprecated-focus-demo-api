'use strict';

const Promise = require('bluebird');
const da = require('distribute-array'); // Used to make indexation batches
const _ = require('lodash');

const DEFAULT_GROUP_TOP = 10;

const initSearchIndex = (searchIndex, options) => searchIndex(options);

const promisifySearchIndex = si => ['add', 'close', 'get', 'del', 'flush', 'match', 'replicate', 'search', 'snapShot', 'tellMeAboutMySearchIndex'].reduce((acc, method) => {
    acc[method] = Promise.promisify(si[method]);
    return acc;
}, {});

const checkIsIndexEmpty = si => si.tellMeAboutMySearchIndex()
.then(infos => infos.totalDocs === 0);

const batchify = (array, batchSize) => da(array, Math.ceil(array.length / batchSize));

const sequencify = (batches, func) => Promise.each(batches, func);

const indexBatch = (si, batch, batchOptions, batchIndex, totalBatches) => {
    console.log(`Indexing batch ${batchIndex + 1}/${totalBatches}`);
    return si.add(batch, batchOptions);
}

const buildSearchQuery = (text, facets, selectedFacets, top, skip) => {
    const query = {query: {'*': [text]}};
    if (skip) query.offset = skip;
    if (top) query.pageSize = top;
    query.facets = _.reduce(facets, (acc, data) => {
        acc[data.fieldName] = {}
        if (data.ranges) {
            acc[data.fieldName].ranges = data.ranges.map(rangeObject => rangeObject.value);
        }
        return acc;
    }, {});
    if (selectedFacets) {
        query.filter = _.reduce(selectedFacets, (acc, facetValue, facetKey) => {
            const correspondingFacet = facets[facetKey];
            acc[correspondingFacet.fieldName] = [correspondingFacet.ranges ? correspondingFacet.ranges.filter(range => range.label === facetValue)[0].value : [facetValue, facetValue]];
            return acc;
        }, {});
    }
    return query;
}

const treatSearchResults = (sortFieldName, sortDesc, facetsConfig) => results => {
    const facets = !_.isEmpty(results.facets) ? results.facets.reduce((acc, facet) => {
        const facetKey = _.reduce(facetsConfig, (facetAcc, facetValue, facetKey) => {
            if (facet.key === facetValue.fieldName) facetAcc = facetKey;
            return facetAcc;
        }, facet.key);
        acc.push({
            [facetKey]: facet.value.reduce((facetAcc, facetValue) => {
                facetAcc.push({
                    [facetValue.key]: facetValue.value
                });
                return facetAcc;
            }, [])
        });
        return acc;
    }, []) : [];
    const totalCount = results.totalHits;
    let list = results.hits.map(hit => hit.document);
    if (sortFieldName) {
        list = _.sortBy(list, sortFieldName);
        if (sortDesc) list = list.reverse();
    }
    return {
        facets,
        totalCount,
        list
    };
}

const groupedSearch = (si, query, groupedField, groupTop) => {
    return si.search(query)
    .then(treatSearchResults)
    .then(firstResults => ({groups: Object.keys(firstResults.facets[groupedField]), facets: firstResults.facets, totalCount: firstResults.totalCount}))
    .then(firstResults => Promise.reduce(firstResults.groups, (acc, groupValue) => {
        const groupQuery = _.clone(query);
        const groupFacets = {[groupedField]: [[groupValue, groupValue]]};
        groupQuery.filter = groupFacets;
        return si.search(groupQuery)
        .then(treatSearchResults)
        .then(results => {
            acc.groups[groupValue] = results.list.slice(0, groupTop || DEFAULT_GROUP_TOP);
            return acc;
        })
    }, {groups: {}, facets: firstResults.facets, totalCount: firstResults.totalCount}))
}

module.exports = {
    initSearchIndex,
    promisifySearchIndex,
    checkIsIndexEmpty,
    batchify,
    sequencify,
    indexBatch,
    treatSearchResults,
    groupedSearch,
    buildSearchQuery
}
