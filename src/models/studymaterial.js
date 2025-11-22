const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class StudyMaterial extends Model {
    static associate(models) {
      StudyMaterial.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
    }
  }
  StudyMaterial.init(
    {
      sessionId: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      file: { type: DataTypes.STRING, allowNull: false }, // file path
      fileType: {
        type: DataTypes.ENUM("pdf", "docx", "txt", "image"),
        allowNull: false,
      },
      extractedText: { type: DataTypes.TEXT },
      uploadedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StudyMaterial",
      tableName: "study_materials",
      timestamps: false,
      defaultScope: { order: [["uploadedAt", "DESC"]] },
    },
  );
  return StudyMaterial;
};
