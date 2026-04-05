import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Card } from 'react-native-paper';

const PortfolioScreen = () => {
  const portfolioSummary = {
    totalInvestment: 25000,
    totalValue: 30000,
    totalReturns: 5000,
  };

  const investments = [
    { id: '1', name: 'Stock A', value: 15000, returns: 2000 },
    { id: '2', name: 'Stock B', value: 10000, returns: 3000 },
    { id: '3', name: 'Stock C', value: 5000, returns: 1000 },
  ];

  const renderInvestmentCard = ({ item }) => (
    <Card style={styles.card}>
      <Card.Title title={item.name} />
      <Card.Content>
        <Text>Value: ${item.value}</Text>
        <Text>Returns: ${item.returns}</Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.summary}>Portfolio Summary</Text>
      <Text>Total Investment: ${portfolioSummary.totalInvestment}</Text>
      <Text>Total Value: ${portfolioSummary.totalValue}</Text>
      <Text>Total Returns: ${portfolioSummary.totalReturns}</Text>
      <FlatList
        data={investments}
        renderItem={renderInvestmentCard}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  summary: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  card: {
    marginVertical: 10,
  },
});

export default PortfolioScreen;