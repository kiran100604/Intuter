const blueprintGenerator = require("./blueprintGenerator");

describe("generateBlueprint", () => {
  let mockGenAI;
  let mockGenerateContent;

  beforeEach(() => {
    mockGenerateContent = jest.fn();
    mockGenAI = {
      getGenerativeModel: jest.fn(() => ({
        generateContent: mockGenerateContent,
      })),
    };
  });

  it("should return a valid blueprint when the AI returns valid JSON", async () => {
    const mockResponse = {
      response: {
        text: () =>
          JSON.stringify({
            topics: [
              {
                name: "Topic 1",
                description: "Description 1",
                difficultyLevel: "beginner",
                prerequisites: [],
                subtopics: [
                  {
                    name: "Subtopic 1.1",
                    description: "Description 1.1",
                    estimatedDuration: 30,
                  },
                ],
              },
            ],
          }),
      },
    };
    mockGenerateContent.mockResolvedValue(mockResponse);

    const result = await blueprintGenerator.generateBlueprint(
      {
        subjectName: "Test Subject",
        goal: "Test Goal",
        outlineText: "Test Outline",
      },
      mockGenAI,
    );

    expect(result).toEqual({
      topics: [
        {
          name: "Topic 1",
          description: "Description 1",
          difficultyLevel: "beginner",
          prerequisites: [],
          subtopics: [
            {
              name: "Subtopic 1.1",
              description: "Description 1.1",
              estimatedDuration: 30,
            },
          ],
        },
      ],
    });
  });

  it("should handle markdown in the AI response", async () => {
    const mockResponse = {
      response: {
        text: () =>
          "```json\n" +
          JSON.stringify({
            topics: [
              {
                name: "Topic 1",
                description: "Description 1",
                difficultyLevel: "beginner",
                prerequisites: [],
                subtopics: [
                  {
                    name: "Subtopic 1.1",
                    description: "Description 1.1",
                    estimatedDuration: 30,
                  },
                ],
              },
            ],
          }) +
          "\n```",
      },
    };
    mockGenerateContent.mockResolvedValue(mockResponse);

    const result = await blueprintGenerator.generateBlueprint(
      {
        subjectName: "Test Subject",
        goal: "Test Goal",
        outlineText: "Test Outline",
      },
      mockGenAI,
    );

    expect(result).toEqual({
      topics: [
        {
          name: "Topic 1",
          description: "Description 1",
          difficultyLevel: "beginner",
          prerequisites: [],
          subtopics: [
            {
              name: "Subtopic 1.1",
              description: "Description 1.1",
              estimatedDuration: 30,
            },
          ],
        },
      ],
    });
  });

  it("should throw an error for invalid JSON", async () => {
    const mockResponse = {
      response: {
        text: () => '{"topics": [}',
      },
    };
    mockGenerateContent.mockResolvedValue(mockResponse);

    await expect(
      blueprintGenerator.generateBlueprint(
        {
          subjectName: "Test Subject",
          goal: "Test Goal",
          outlineText: "Test Outline",
        },
        mockGenAI,
      ),
    ).rejects.toThrow("Failed to parse AI response");
  });
});
