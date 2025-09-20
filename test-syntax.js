const testAsync = async () => {
  console.log('Test');
  const result = await Promise.resolve('hello');
  console.log(result);
};

testAsync();