export type Problem = {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  examples: { input: any; output: any; explanation?: string }[];
  starterCode: Record<string, string>; 
};

export const problems: Problem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    examples: [
      { input: { nums: [2,7,11,15], target: 9 }, output: [0,1] },
    ],
    starterCode: {
      javascript: `function twoSum(nums, target){\n  // TODO\n}\nmodule.exports = twoSum;`,
      python: `def twoSum(nums, target):\n    # TODO\n    pass`,
      java: `class Solution{\n  int[] twoSum(int[] nums, int target){\n    // TODO\n    return new int[]{};\n  }\n}`,
      cpp: `vector<int> twoSum(vector<int>& nums, int target){\n  // TODO\n}`,
    },
  },
];
