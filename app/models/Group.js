/**
 * Dependencies.
 */
var errors = require('../lib/errors');

/**
 * Model.
 */
module.exports = function(Sequelize, DataTypes) {
  
  var Group = Sequelize.define('Group', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.STRING,

    membership_type: DataTypes.ENUM('donation', 'monthlyfee', 'yearlyfee'),
    membershipfee: DataTypes.FLOAT,

    createdAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW
    }

  }, {
    paranoid: true,

    getterMethods: {
      // Info.
      info: function() {
        return {
            id: this.id
          , name: this.name
          , description: this.description
          , membership_type: this.membership_type
          , membershipfee: this.membershipfee
          , createdAt: this.createdAt
          , updatedAt: this.updatedAt
        };
      },
    },

    instanceMethods: {
      isMember: function(user_id, roles, fn) {
        if (!roles || typeof roles === 'function') {
          fn = roles;
          roles = null;
        }
        this
          .getMembers({where: {id: user_id} })
          .then(function(members) {
            if (members.length === 0)
              return fn(new errors.Forbidden('Unauthorized to access this group.'));
            else {
              if (roles && roles.indexOf(members[0].UserGroup.role) < 0 )
                return fn(new errors.Forbidden('Unauthorized to manage this group.'));
              fn();
            }
          })
          .catch(fn);
      },
    }
  });

  return Group;
};