import parse from '../parse/index.js';

const test = (condition) => {
  if (typeof condition !== 'string') return false;

  try {
    const { result } = parse(condition);
    return result.success;
  } catch {
    return false;
  }
};

export default test;
