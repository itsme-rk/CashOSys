import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, ScrollView, } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { getTransactionsByCycle } from '../../services/transaction';
import { getActiveSalaryCycle } from '../../services/salaryCycle';

export const ExpenseListScreen = ({ navigation }) => {
    const { user } = useContext(AuthContext);
    const [expenses, setExpenses] = useState([]);
    const [filteredExpenses, setFilteredExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const expenseCategories = [
        'All', 'Food & Dining', 'Transportation', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Others',
    ];

    useEffect(() => {
        loadExpenses();
    }, [user]);

    const loadExpenses = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const activeCycle = await getActiveSalaryCycle(user.uid);
            if (activeCycle) {
                const allTransactions = await getTransactionsByCycle(user.uid, activeCycle.cycleId);
                const expenseList = allTransactions.filter((t) => t.type === 'expense');
                setExpenses(expenseList);
                applyFilters(expenseList, selectedCategory, searchQuery);
            }
        } catch (error) {
            console.error('Error loading expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = (list, category, query) => {
        let filtered = list;
        if (category !== 'All') {
            filtered = filtered.filter((exp) => exp.category === category);
        }
        if (query) {
            filtered = filtered.filter((exp) =>
                exp.description.toLowerCase().includes(query.toLowerCase()) ||
                exp.category.toLowerCase().includes(query.toLowerCase())
            );
        }
        setFilteredExpenses(filtered);
    };

    const handleCategoryFilter = (category) => {
        setSelectedCategory(category);
        applyFilters(expenses, category, searchQuery);
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
        applyFilters(expenses, selectedCategory, text);
    };

    const renderExpenseItem = ({ item }) => (
        <View style={styles.expenseCard}>
            <View style={styles.expenseInfo}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.date}>{new Date(item.date.toDate()).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.amount}>-${item.amount.toFixed(2)}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Expenses</Text>
            <TextInput
                style={styles.searchBox}
                placeholder="Search expenses..."
                value={searchQuery}
                onChangeText={handleSearch}
                placeholderTextColor="#999"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {expenseCategories.map((category) => (
                    <TouchableOpacity 
                        key={category}
                        style={[ styles.categoryChip, selectedCategory === category && styles.categoryChipActive, ]}
                        onPress={() => handleCategoryFilter(category)}
                    >
                        <Text style={[ styles.categoryChipText, selectedCategory === category && styles.categoryChipTextActive, ]}>
                            {category}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <FlatList
                data={filteredExpenses}
                renderItem={renderExpenseItem}
                keyExtractor={(item) => item.transactionId}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadExpenses} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No expenses found</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 15,
    },
    searchBox: {
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    categoryScroll: {
        marginBottom: 15,
    },
    categoryChip: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    categoryChipActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    categoryChipText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
    },
    categoryChipTextActive: {
        color: '#fff',
    },
    expenseCard: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
    },
    expenseInfo: {
        flex: 1,
    },
    category: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    description: {
        fontSize: 12,
        color: '#666',
        marginBottom: 3,
    },
    date: {
        fontSize: 11,
        color: '#999',
    },
    amount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF3B30',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
});
