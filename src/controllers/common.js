const Promise = require('bluebird');

const searchIndex = require('../search');

const search = (req, res) => {
    const criteria = req.body.criteria;
    if (criteria === '*') {
        res.json({groups: [], facets: [], totalCount: 0});
    } else {
        Promise.mapSeries([searchIndex.movies.search, searchIndex.persons.search], method => method(criteria))
        .then(results => {
            const movies = results[0];
            const persons = results[1];
            const moviesCount = movies ? movies.totalCount : 0;
            const personsCount = persons ? persons.totalCount : 0;
            const totalCount = moviesCount + personsCount;
            const facets = [{
                code: 'FCT_SCOPE',
                entries: [
                    {
                        code: 'movie',
                        label: 'Movies',
                        value: moviesCount
                    },
                    {
                        code: 'person',
                        label: 'Persons',
                        value: personsCount
                    }
                ].filter(entry => entry.value > 0)
            }];
            const groups = [
                {
                    code: 'movie',
                    label: 'Movies',
                    list: movies ? movies.list.slice(0, 10) : [],
                    totalCount: moviesCount
                },
                {
                    code: 'person',
                    label: 'Persons',
                    list: persons ? persons.list.slice(0, 10) : [],
                    totalCount: personsCount
                }
            ];
            res.json({groups, facets, totalCount});
        })
        .catch(error => res.status(500).send(error))
    }
}

module.exports = {
    search
}
