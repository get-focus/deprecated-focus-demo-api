const Promise = require('bluebird');

const searchIndex = require('../search');

const search = (req, res) => {
    const criteria = req.body.criteria;
    if (criteria === '*') {
        res.json({groups: [], facets: [], totalCount: 0});
    } else {
        Promise.all([searchIndex.movies.search(criteria), searchIndex.persons.search(criteria)])
        .then(results => {
            const movies = results[0];
            const persons = results[1];
            const totalCount = movies.totalCount + persons.totalCount;
            const facets = [{
                code: 'FCT_SCOPE',
                entries: [
                    {
                        code: 'person',
                        label: 'Persons',
                        value: persons.totalCount
                    },
                    {
                        code: 'movie',
                        label: 'Movies',
                        value: movies.totalCount
                    }
                ]
            }];
            const groups = [
                {
                    code: 'movie',
                    label: 'Movies',
                    list: movies.list.slice(0, 10),
                    totalCount: movies.totalCount
                },
                {
                    code: 'person',
                    label: 'Persons',
                    list: persons.list.slice(0, 10),
                    totalCount: persons.totalCount
                }
            ];
            res.json({groups, facets, totalCount});
        });
    }
}

module.exports = {
    search
}
