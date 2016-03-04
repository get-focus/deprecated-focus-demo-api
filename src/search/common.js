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
            acc[correspondingFacet.fieldName] = [correspondingFacet.ranges ? correspondingFacet.ranges.filter(range => range.code === facetValue)[0].value : [facetValue, facetValue]];
            return acc;
        }, {});
    }
    return query;
}

const treatSearchResults = (sortFieldName, sortDesc, facetsConfig) => results => {
    const facets = !_.isEmpty(results.facets) ? results.facets.reduce((acc, facet) => {
        // Facet has the shape {key: 'movieType', value: [{key: 'Long-métrage', gte: 'Long-métrage', lte: 'Long-métrage', value: 137, active: true}]}
        // Facet key, such as FCT_MOVIE_TYPE
        const facetKey = _.reduce(facetsConfig, (facetAcc, facetValue, facetKey) => {
            if (facet.key === facetValue.fieldName) facetAcc = facetKey;
            return facetAcc;
        }, facet.key);
        const isRangeFacet = !!facetsConfig[facetKey].ranges;
        // Construct the object {FCT_MOVIE_TITLE: [{code: 'R1', label: '#', count: 42}, ...]}
        acc.push({
            code: facetKey,
            entries: facet.value.reduce((facetEntriesArray, siFacetValue) => {
                if (isRangeFacet) {
                    // Get the range config, ie {code: 'R1', value: ['', '9'], label: '#'}
                    const facetEntryRangeConfig = facetsConfig[facetKey].ranges.filter(range => (range.value[0] === siFacetValue.gte && range.value[1] === siFacetValue.lte))[0];
                    facetEntriesArray.push({
                        code: facetEntryRangeConfig.code,
                        label: facetEntryRangeConfig.label,
                        value: siFacetValue.value
                    });
                } else {
                    facetEntriesArray.push({
                        code: siFacetValue.key,
                        label: siFacetValue.key,
                        value: siFacetValue.value
                    });
                }
                return facetEntriesArray;
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

const groupedSearch = (si, query, groupFieldName, groupFacetName, groupTop, facetConfig) => {
    return si.search(query)
    .then(treatSearchResults(null, null, facetConfig))
    .then(firstResults => {
        // save the totalCount and facets for the final response
        const totalCount = firstResults.totalCount;
        const facets = firstResults.facets;
        // Get the group facet config
        const groupFacet = facetConfig[groupFacetName];
        const isRangeFacet = !! groupFacet.ranges;
        // Get the group facet entries, ie [{code: 'R1', label: '#', value: 10}]
        const groupFacetEntries = firstResults.facets.filter(facet => facet.code === groupFacetName)[0].entries;
        let groupQueries;
        if (isRangeFacet) {
            groupQueries = groupFacetEntries.map(groupFacetEntry => {
                const groupFacetEntryQuery = _.cloneDeep(query);
                groupFacetEntryQuery.filter = groupFacetEntryQuery.filter || {}; // Remember potential other filters
                groupFacetEntryQuery.filter[groupFieldName] = [groupFacet.ranges.filter(range => range.code === groupFacetEntry.code)[0].value];
                groupFacetEntryQuery.code = groupFacetEntry.code; // Remember the code for later, will not be used by search-index
                groupFacetEntryQuery.label = groupFacetEntry.label; // Remember the label for later, will not be used by search-index
                return groupFacetEntryQuery;
            });
        } else {
            groupQueries = groupFacetEntries.map(groupFacetEntry => {
                const groupFacetEntryQuery = _.cloneDeep(query);
                groupFacetEntryQuery.filter = groupFacetEntryQuery.filter || {}; // Remember potential other filters
                groupFacetEntryQuery.filter[groupFieldName] = [[groupFacetEntry.code, groupFacetEntry.code]];
                groupFacetEntryQuery.code = groupFacetEntry.code; // Remember the code for later, will not be used by search-index
                groupFacetEntryQuery.label = groupFacetEntry.label; // Remember the label for later, will not be used by search-index
                return groupFacetEntryQuery;
            });
        }
        return Promise.reduce(groupQueries, (result, groupQuery) => {
            return si.search(groupQuery)
            .then(treatSearchResults(null, null, facetConfig))
            .then(groupEntrySearchResult => {
                result.groups.push({
                    code: groupQuery.code,
                    label: groupQuery.label,
                    list: groupEntrySearchResult.list.slice(0, groupTop || DEFAULT_GROUP_TOP),
                    totalCount: groupEntrySearchResult.totalCount
                })
                return result;
            })
        }, {groups: [], totalCount, facets});
    })
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
