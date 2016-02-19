// Libraries imports

const Sequelize = require('sequelize');
const da = require('distribute-array');
const Promise = require('bluebird');

// Configuration

const BATCH_SIZE = 1000;

// Items definitions

const sequelize = new Sequelize('focus-demo-app', '', '', {
    dialect: 'sqlite',
    storage: './src/database/db.sqlite',
    logging: false
});

const Movie = sequelize.define('movie', {
    code: {
        type: Sequelize.INTEGER,
        primaryKey: true
    },
    keywords: Sequelize.STRING,
    movieType: Sequelize.STRING,
    originalTitle: Sequelize.STRING,
    poster: Sequelize.STRING,
    pressRating: Sequelize.INTEGER,
    productionYear: Sequelize.INTEGER,
    runtime: Sequelize.INTEGER,
    shortSynopsis: Sequelize.TEXT,
    synopsis: Sequelize.TEXT,
    title: Sequelize.STRING,
    trailerHRef: Sequelize.STRING,
    trailerName: Sequelize.STRING,
    userRating: Sequelize.INTEGER
});

const Person = sequelize.define('person', {
    code: {
        type: Sequelize.INTEGER,
        primaryKey: true
    },
    fullName: Sequelize.STRING,
    firstName: Sequelize.STRING,
    biography: Sequelize.TEXT,
    shortBiography: Sequelize.TEXT,
    sex: Sequelize.STRING,
    photoURL: Sequelize.STRING,
    birthDate: Sequelize.DATE,
    birthPlace: Sequelize.STRING,
    activity: Sequelize.STRING
});

const MoviePerson = sequelize.define('moviePerson', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    movieCode: {
        type: Sequelize.STRING
    },
    personCode: {
        type: Sequelize.STRING
    },
    name: Sequelize.STRING,
    type: {
        type: Sequelize.STRING,
        allowNull: false
    },
    role: Sequelize.STRING,
    leadActor: Sequelize.BOOLEAN
});

Movie.belongsToMany(Person, {through: {model: 'moviePerson', unique: false}, foreignKey: 'movieCode', otherKey: 'personCode', constraints: false});

// Pure functions

const initDatabase = sequelize => sequelize.sync();

const countMovies = Movie => Movie.count();

const checkIsDatabaseEmpty = Movie => countMovies(Movie)
.then(count => count === 0);

const getRawMovies = () => Promise.resolve(require('../db-movies.json'));

const getRawPersons = () => Promise.resolve(require('../db-persons.json'));

const batchify = (array, batchSize) => Promise.resolve(da(array, Math.ceil(array.length / batchSize)));

const sequencify = (batches, func) => Promise.each(batches, func);

const insertMoviePersonBatch = (batch, MoviePerson) => {
    const roles = ['actor', 'director', 'producer', 'writer'];
    return MoviePerson.bulkCreate(roles.reduce((roleAcc, role) => {
        return roleAcc.concat(batch.reduce((movieAcc, movie) => {
            if (!movie[`${role}s`]) return movieAcc;
            return movieAcc.concat(movie[`${role}s`].map(person => ({
                movieCode: movie.code,
                personCode: person.code,
                name: person.name,
                type: role,
                role: person.role,
                leadActor: person.leadActor
            })));
        }, []));
    }, []));
}

const insertMovieBatch = (batch, Movie) => Movie.bulkCreate(batch);

const insertPersonBatch = (batch, Person) => Person.bulkCreate(batch);

const populateDatabase = (Movie, Person, MoviePerson, batchSize) => getRawPersons()
.then(persons => batchify(persons, batchSize))
.then(batches => sequencify(batches, batch => insertPersonBatch(batch, Person)))
.then(() => getRawMovies())
.then(movies => batchify(movies, batchSize))
.then(batches => sequencify(batches, batch => insertMovieBatch(batch, Movie).then(() => insertMoviePersonBatch(batch, MoviePerson))));

const init = () => {
    return initDatabase(sequelize)
    .then(() => Promise.resolve(checkIsDatabaseEmpty(Movie)))
    .then(empty => {
        if (empty) {
            return populateDatabase(Movie, Person, MoviePerson, BATCH_SIZE);
        } else {
            return Promise.resolve();
        }
    });
}

// Exports

module.exports = {
    sequelize,
    init,
    Movie,
    Person,
    MoviePerson
}
