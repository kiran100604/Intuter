const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ContextCache extends Model {
    static associate(models) {
      ContextCache.belongsTo(models.StudySession, { foreignKey: 'sessionId', as: 'session' });
    }
  }
  ContextCache.init({
    sessionId: { type: DataTypes.INTEGER, allowNull: false },
    cacheKey: { type: DataTypes.STRING, allowNull: false },
    cachedData: { type: DataTypes.JSON, allowNull: false },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    expiresAt: { type: DataTypes.DATE, allowNull: false }
  }, {
    sequelize,
    modelName: 'ContextCache',
    tableName: 'context_cache',
    timestamps: false,
    indexes: [{ fields: ['createdAt'] }],
    defaultScope: { order: [['createdAt', 'DESC']] },
    uniqueKeys: {
      unique_cache: {
        fields: ['sessionId', 'cacheKey']
      }
    }
  });
  return ContextCache;
};
