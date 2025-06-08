const ValidatorRegistry = require('./ValidatorRegistry');

function getValidator(type) {
    const validator = ValidatorRegistry.getValidator(type);
    if (!validator) {
        throw new Error(`Validator type '${type}' not found`);
    }
    return validator;
}

const validators = {
    get FullName() { return getValidator('Name'); },
    get City() { return getValidator('Location'); },
    get Area() { return getValidator('Location'); },
    get Location() { return getValidator('Location'); },
    get Name() { return getValidator('Name'); }
};

module.exports = {
    getValidator,
    validators,
    ValidatorRegistry
};
