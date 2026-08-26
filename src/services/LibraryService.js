import AbstractService from 'services/AbstractService'
import Logger from 'common/Logger'

/**
 * Library (component library) permission levels.
 *
 * NOTE: the semantics are INVERTED compared to app permissions:
 * 3 = owner, 2 = editor (read+write), 1 = viewer (read only).
 * Do not reuse the app PERMISSIONS constants here.
 */
export const LIB_PERMISSIONS = {
    READ: 1,
    WRITE: 2,
    OWNER: 3
}

export class LibraryService extends AbstractService {

    constructor () {
        super()
        this.logger = new Logger('LibraryService')
    }

    /**
     * Returns all libraries the current user is a member of.
     * @returns {Promise<Array>}
     */
    findLibs () {
        this.logger.log(6, 'findLibs', 'enter')
        return this._get('/rest/libs')
    }

    /**
     * Returns one library. The `data` object (widgets / screens / groups /
     * templates / grid / lines) is expanded onto the top level by the backend.
     * @returns {Promise<Object>}
     */
    findLib (libID) {
        this.logger.log(6, 'findLib', 'enter', libID)
        return this._get(`/rest/libs/${libID}.json`)
    }

    /**
     * Creates a new library and returns it (with the creator as owner team member).
     * @param {String} name
     * @param {String} description
     * @param {Boolean} isPublic
     * @returns {Promise<Object>}
     */
    createLib (name, description, isPublic) {
        this.logger.log(1, 'createLib', 'enter', name)
        return this._post('/rest/libs', {
            name: name,
            description: description,
            isPublic: isPublic || false
        })
    }

    /**
     * Updates a library. The patch may contain name / description / isPublic
     * and any of the data fields widgets / screens / groups / templates / grid / lines.
     * @param {String} libID
     * @param {Object} patch
     * @returns {Promise<Object>}
     */
    updateLib (libID, patch) {
        this.logger.log(1, 'updateLib', 'enter', libID, patch)
        return this._post(`/rest/libs/${libID}.json`, patch)
    }

    /**
     * Deletes a library (owner / creator only).
     * @param {String} libID
     * @returns {Promise<Object>}
     */
    deleteLib (libID) {
        this.logger.log(-1, 'deleteLib', 'enter', libID)
        return this._delete(`/rest/libs/${libID}`)
    }

    /**
     * Returns the team members of a library.
     * Each member: { _id, id, name, lastname, email, image, permission }
     * @param {String} libID
     * @returns {Promise<Array>}
     */
    findTeam (libID) {
        this.logger.log(6, 'findTeam', 'enter', libID)
        return this._get(`/rest/libs/${libID}/team.json`)
    }

    /**
     * Returns candidate users for the team picker.
     * Each candidate: { _id, id, name, lastname, email, image } (no permission).
     * @param {String} libID
     * @param {String} query optional search string
     * @returns {Promise<Array>}
     */
    findTeamSuggestions (libID, query) {
        this.logger.log(6, 'findTeamSuggestions', 'enter', libID, query)
        if (query) {
            return this._get(`/rest/libs/${libID}/suggestions/team.json?query=${encodeURIComponent(query)}`)
        }
        return this._get(`/rest/libs/${libID}/suggestions/team.json`)
    }

    /**
     * Adds a user (by email) to the library team.
     * @param {String} libID
     * @param {String} email
     * @param {Number} permission one of LIB_PERMISSIONS (READ / WRITE, NOT OWNER)
     * @returns {Promise<Object>}
     */
    addTeam (libID, email, permission) {
        this.logger.log(1, 'addTeam', 'enter', libID, email, permission)
        return this._post(`/rest/libs/${libID}/team`, {
            email: email,
            permission: permission
        })
    }

    /**
     * Updates the permission of an existing team member.
     * @param {String} libID
     * @param {String} userID
     * @param {Number} permission one of LIB_PERMISSIONS (READ / WRITE, NOT OWNER)
     * @returns {Promise<Object>}
     */
    updateTeam (libID, userID, permission) {
        this.logger.log(1, 'updateTeam', 'enter', libID, userID, permission)
        return this._post(`/rest/libs/${libID}/team/${userID}`, {
            permission: permission
        })
    }

    /**
     * Removes a user from the library team (cannot remove yourself).
     * @param {String} libID
     * @param {String} userID
     * @returns {Promise<Object>}
     */
    removeTeam (libID, userID) {
        this.logger.log(1, 'removeTeam', 'enter', libID, userID)
        return this._delete(`/rest/libs/${libID}/team/${userID}`)
    }
}
export default new LibraryService()
