/**
 * 财务记录系统前端JavaScript
 * 处理用户交互和API调用
 */

// 全局配置
const CONFIG = {
    API_BASE: '/api',
    ANIMATION_DURATION: 300,
    AUTO_HIDE_DELAY: 10000
};

// 全局状态
const STATE = {
    isLoading: false,
    lastResult: null,
    autoHideTimer: null
};

/**
 * 工具函数
 */
const Utils = {
    // 显示/隐藏加载状态
    showLoading(show = true) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
            STATE.isLoading = show;
        }
    },

    // 显示结果信息
    showResult(message, type = 'success', data = null) {
        const resultBox = document.getElementById('resultBox');
        if (!resultBox) return;

        // 清除之前的自动隐藏定时器
        if (STATE.autoHideTimer) {
            clearTimeout(STATE.autoHideTimer);
        }

        resultBox.className = `result-box result-${type}`;
        resultBox.style.display = 'block';
        
        let html = `<strong>${message}</strong>`;
        
        if (data) {
            html += `<div class="data-display">${this.formatData(data)}</div>`;
        }
        
        resultBox.innerHTML = html;
        STATE.lastResult = { message, type, data };

        // 滚动到结果区域
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // 自动隐藏（除了错误信息）
        if (type !== 'error') {
            STATE.autoHideTimer = setTimeout(() => {
                this.hideResult();
            }, CONFIG.AUTO_HIDE_DELAY);
        }
    },

    // 隐藏结果
    hideResult() {
        const resultBox = document.getElementById('resultBox');
        if (resultBox) {
            resultBox.style.display = 'none';
        }
        if (STATE.autoHideTimer) {
            clearTimeout(STATE.autoHideTimer);
            STATE.autoHideTimer = null;
        }
    },

    // 格式化数据显示
    formatData(data) {
        if (typeof data === 'object') {
            return JSON.stringify(data, null, 2);
        }
        return String(data);
    },

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 格式化金额
    formatAmount(amount) {
        return parseFloat(amount).toFixed(2);
    },

    // 获取当前日期时间
    getCurrentDateTime() {
        return new Date().toLocaleString('zh-CN');
    }
};

/**
 * API调用函数
 */
const API = {
    // 基础请求方法
    async request(url, options = {}) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    },

    // 提交交易
    async submitTransaction(text) {
        return this.request('/transaction', {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    },

    // 获取所有余额
    async getBalances() {
        return this.request('/balances');
    },

    // 搜索交易
    async searchTransactions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/transactions/search?${queryString}`);
    },

    // 获取月度报表
    async getMonthlyReport(year, month) {
        return this.request(`/report/monthly?year=${year}&month=${month}`);
    },

    // 验证账户
    async validateAccounts() {
        return this.request('/validate');
    },

    // 删除交易
    async deleteTransaction(id) {
        return this.request(`/transaction/${id}`, {
            method: 'DELETE'
        });
    }
};

/**
 * 业务功能函数
 */

// 填入示例文本
function fillExample(text) {
    const input = document.getElementById('transactionInput');
    if (input) {
        input.value = text;
        input.focus();
        Utils.hideResult();
        
        // 添加一个小动画效果
        input.style.transform = 'scale(1.02)';
        setTimeout(() => {
            input.style.transform = 'scale(1)';
        }, 200);
    }
}

// 提交交易记录
async function submitTransaction() {
    const input = document.getElementById('transactionInput');
    if (!input) return;

    const text = input.value.trim();
    
    if (!text) {
        Utils.showResult('请输入交易记录', 'error');
        input.focus();
        return;
    }

    if (STATE.isLoading) {
        Utils.showResult('正在处理中，请稍候...', 'warning');
        return;
    }

    Utils.showLoading(true);
    Utils.hideResult();
    
    try {
        const result = await API.submitTransaction(text);
        
        if (result.success) {
            const transactionData = result.data.transaction_data;
            const validationResult = result.data.validation_result;
            
            // 构建成功消息
            let successData = {
                '交易ID': result.data.transaction_id,
                '借方账户': transactionData.debit_account,
                '贷方账户': transactionData.credit_account,
                '金额': `${Utils.formatAmount(transactionData.amount)} 元`,
                '分类': transactionData.category,
                '置信度': `${(transactionData.confidence * 100).toFixed(1)}%`,
                '处理时间': Utils.getCurrentDateTime()
            };

            // 添加警告和建议信息
            if (validationResult.warnings.length > 0) {
                successData['警告'] = validationResult.warnings;
            }
            if (validationResult.suggestions.length > 0) {
                successData['建议'] = validationResult.suggestions;
            }

            Utils.showResult('✅ 交易记录保存成功！', 'success', successData);
            
            // 清空输入框
            input.value = '';
            
            // 自动刷新余额显示（如果当前显示着余额）
            const balanceGrid = document.getElementById('balanceGrid');
            if (balanceGrid && balanceGrid.style.display !== 'none') {
                setTimeout(() => getBalances(), 1000);
            }
            
        } else {
            let errorData = {
                '原文本': text,
                '错误详情': result.data
            };
            
            if (result.data && result.data.missing_info) {
                errorData['缺失信息'] = result.data.missing_info;
            }
            
            Utils.showResult(`❌ ${result.message}`, 'error', errorData);
        }
        
    } catch (error) {
        Utils.showResult(`❌ 网络错误: ${error.message}`, 'error', {
            '错误类型': error.name,
            '错误详情': error.message,
            '发生时间': Utils.getCurrentDateTime()
        });
    } finally {
        Utils.showLoading(false);
    }
}

// 获取所有余额
async function getBalances() {
    if (STATE.isLoading) return;

    Utils.showLoading(true);
    Utils.hideResult();
    
    try {
        const result = await API.getBalances();
        
        if (result.success) {
            displayBalances(result.data.balances);
            Utils.showResult(`📊 查询到 ${result.data.total_accounts} 个账户`, 'success');
        } else {
            Utils.showResult(`❌ ${result.message}`, 'error');
        }
        
    } catch (error) {
        Utils.showResult(`❌ 网络错误: ${error.message}`, 'error');
    } finally {
        Utils.showLoading(false);
    }
}

// 显示余额
function displayBalances(balances) {
    const grid = document.getElementById('balanceGrid');
    if (!grid) return;

    grid.innerHTML = '';
    grid.style.display = 'grid';
    
    // 按账户类型分组
    const groupedBalances = balances.reduce((groups, balance) => {
        const type = balance.account_type;
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(balance);
        return groups;
    }, {});

    // 账户类型的中文名称映射
    const typeNames = {
        'asset': '💰 资产账户',
        'liability': '💳 负债账户', 
        'expense': '💸 费用账户',
        'revenue': '💵 收入账户',
        'equity': '📈 权益账户'
    };

    // 为每个账户类型创建区域
    Object.keys(groupedBalances).forEach(type => {
        // 创建类型标题
        const typeHeader = document.createElement('div');
        typeHeader.className = 'balance-type-header';
        typeHeader.style.cssText = `
            grid-column: 1 / -1;
            font-size: 18px;
            font-weight: bold;
            color: #2ed573;
            margin: 10px 0;
            padding-bottom: 5px;
            border-bottom: 2px solid #2ed573;
        `;
        typeHeader.textContent = typeNames[type] || `📊 ${type}`;
        grid.appendChild(typeHeader);

        // 创建该类型下的余额卡片
        groupedBalances[type].forEach(balance => {
            const card = document.createElement('div');
            card.className = 'balance-card';
            
            const amountClass = balance.balance < 0 ? 'balance-amount balance-negative' : 'balance-amount';
            const balanceIcon = balance.balance >= 0 ? '📈' : '📉';
            
            card.innerHTML = `
                <h3>${balance.account_name}</h3>
                <div class="${amountClass}">${balanceIcon} ${Utils.formatAmount(balance.balance)} 元</div>
                <small>类型: ${balance.account_type} | 更新: ${new Date(balance.last_updated).toLocaleDateString()}</small>
            `;
            
            // 添加点击事件，显示该账户的交易记录
            card.onclick = () => searchTransactionsByAccount(balance.account_name);
            card.style.cursor = 'pointer';
            card.title = `点击查看 ${balance.account_name} 的交易记录`;
            
            grid.appendChild(card);
        });
    });
}

// 按账户搜索交易记录
async function searchTransactionsByAccount(accountName) {
    if (STATE.isLoading) return;

    Utils.showLoading(true);
    
    try {
        const result = await API.searchTransactions({ account: accountName, limit: 10 });
        
        if (result.success) {
            const transactions = result.data.transactions.map(t => ({
                日期: t.date,
                描述: t.description,
                金额: `${Utils.formatAmount(t.total_amount)} 元`,
                分类: t.category || '未分类'
            }));
            
            Utils.showResult(`🔍 ${accountName} 最近10笔交易`, 'success', {
                账户名称: accountName,
                交易记录: transactions
            });
        } else {
            Utils.showResult(`❌ ${result.message}`, 'error');
        }
        
    } catch (error) {
        Utils.showResult(`❌ 查询失败: ${error.message}`, 'error');
    } finally {
        Utils.showLoading(false);
    }
}

// 搜索交易记录
async function searchTransactions() {
    const keyword = prompt('请输入搜索关键词:');
    if (!keyword || !keyword.trim()) return;

    if (STATE.isLoading) return;
    
    Utils.showLoading(true);
    Utils.hideResult();
    
    try {
        const result = await API.searchTransactions({ keyword: keyword.trim(), limit: 20 });
        
        if (result.success) {
            const searchResults = {
                搜索关键词: keyword,
                找到记录数: result.data.count,
                搜索时间: Utils.getCurrentDateTime()
            };

            if (result.data.transactions.length > 0) {
                searchResults.交易记录 = result.data.transactions.map(t => ({
                    ID: t.id,
                    日期: t.date,
                    描述: t.description,
                    金额: `${Utils.formatAmount(t.total_amount)} 元`,
                    分类: t.category || '未分类',
                    动作: t.action
                }));
            }

            Utils.showResult(`🔍 ${result.message}`, 'success', searchResults);
        } else {
            Utils.showResult(`❌ ${result.message}`, 'error');
        }
        
    } catch (error) {
        Utils.showResult(`❌ 搜索失败: ${error.message}`, 'error');
    } finally {
        Utils.showLoading(false);
    }
}

// 获取月度报表
async function getMonthlyReport() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    if (STATE.isLoading) return;
    
    Utils.showLoading(true);
    Utils.hideResult();
    
    try {
        const result = await API.getMonthlyReport(year, month);
        
        if (result.success) {
            const reportData = {
                报表月份: `${year}年${month}月`,
                总收入: `${Utils.formatAmount(result.data.total_income)} 元`,
                总支出: `${Utils.formatAmount(result.data.total_expense)} 元`,
                净收入: `${Utils.formatAmount(result.data.net_income)} 元`,
                收支比: result.data.total_income > 0 ? 
                       `${((result.data.total_expense / result.data.total_income) * 100).toFixed(1)}%` : 'N/A',
                生成时间: Utils.getCurrentDateTime()
            };

            if (Object.keys(result.data.expense_by_category).length > 0) {
                const categoryData = {};
                Object.entries(result.data.expense_by_category).forEach(([category, amount]) => {
                    categoryData[category] = `${Utils.formatAmount(amount)} 元`;
                });
                reportData.支出分类 = categoryData;
            }

            Utils.showResult(`📈 ${year}年${month}月财务报表`, 'success', reportData);
        } else {
            Utils.showResult(`❌ ${result.message}`, 'error');
        }
        
    } catch (error) {
        Utils.showResult(`❌ 报表生成失败: ${error.message}`, 'error');
    } finally {
        Utils.showLoading(false);
    }
}

// 验证账目
async function validateAccounts() {
    if (STATE.isLoading) return;
    
    Utils.showLoading(true);
    Utils.hideResult();
    
    try {
        const result = await API.validateAccounts();
        
        if (result.success) {
            const data = result.data;
            const validationData = {
                验证时间: Utils.getCurrentDateTime(),
                总账户数: data.total_accounts,
                差异账户数: data.discrepancies_count
            };

            if (data.discrepancies_count === 0) {
                validationData.验证结果 = '✅ 所有账户余额一致';
                Utils.showResult('✅ 账目验证通过，所有账户余额一致！', 'success', validationData);
            } else {
                validationData.验证结果 = '⚠️ 发现余额不一致';
                validationData.差异详情 = {};
                
                Object.entries(data.discrepancies).forEach(([account, details]) => {
                    validationData.差异详情[account] = {
                        计算余额: `${Utils.formatAmount(details.calculated)} 元`,
                        存储余额: `${Utils.formatAmount(details.stored)} 元`,
                        差异金额: `${Utils.formatAmount(details.difference)} 元`
                    };
                });

                Utils.showResult(`⚠️ 发现 ${data.discrepancies_count} 个账户余额不一致`, 'warning', validationData);
            }
        } else {
            Utils.showResult(`❌ ${result.message}`, 'error');
        }
        
    } catch (error) {
        Utils.showResult(`❌ 验证失败: ${error.message}`, 'error');
    } finally {
        Utils.showLoading(false);
    }
}

/**
 * 高级功能
 */

// 导出数据（虚拟功能，可以扩展）
async function exportData() {
    if (STATE.isLoading) return;
    
    try {
        const result = await API.searchTransactions({ limit: 1000 });
        if (result.success) {
            const csvData = convertToCSV(result.data.transactions);
            downloadCSV(csvData, `财务记录_${new Date().toISOString().split('T')[0]}.csv`);
            Utils.showResult('📄 数据导出成功', 'success');
        }
    } catch (error) {
        Utils.showResult(`❌ 导出失败: ${error.message}`, 'error');
    }
}

// 转换为CSV格式
function convertToCSV(data) {
    const headers = ['ID', '日期', '描述', '金额', '动作', '分类', '置信度'];
    const csvContent = [
        headers.join(','),
        ...data.map(row => [
            row.id,
            row.date,
            `"${row.description}"`,
            row.total_amount,
            row.action,
            row.category || '',
            row.confidence || 1.0
        ].join(','))
    ].join('\n');
    
    return csvContent;
}

// 下载CSV文件
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 清空结果显示
function clearResults() {
    Utils.hideResult();
    const balanceGrid = document.getElementById('balanceGrid');
    if (balanceGrid) {
        balanceGrid.style.display = 'none';
        balanceGrid.innerHTML = '';
    }
    Utils.showResult('🧹 显示区域已清空', 'success');
}

// 显示帮助信息
function showHelp() {
    const helpData = {
        '基本用法': [
            '输入自然语言描述交易，如："买了咖啡25块用支付宝付的"',
            '支持中英文混合输入',
            '系统会自动识别金额、支付方式和分类'
        ],
        '支持的交易类型': [
            '支出：买了、花了、付了、消费',
            '收入：收到、到账、发工资、赚了',
            '转账：转账、提现、充值'
        ],
        '支持的支付方式': [
            '支付宝、微信、现金、银行卡、信用卡'
        ],
        '快捷键': [
            'Enter：提交交易记录',
            'Esc：清空输入框'
        ]
    };
    
    Utils.showResult('💡 使用帮助', 'success', helpData);
}

/**
 * 事件监听和初始化
 */

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('财务记录系统前端已加载');
    
    // 绑定回车键提交
    const input = document.getElementById('transactionInput');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitTransaction();
            }
        });
        
        // 绑定ESC键清空
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                input.value = '';
                Utils.hideResult();
            }
        });
        
        // 输入防抖，实时验证
        input.addEventListener('input', Utils.debounce(function(e) {
            const text = e.target.value.trim();
            if (text.length > 0) {
                // 可以在这里添加实时验证逻辑
            }
        }, 500));
    }
    
    // 添加键盘快捷键支持
    document.addEventListener('keydown', function(e) {
        // Ctrl+H 显示帮助
        if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            showHelp();
        }
        
        // Ctrl+B 查看余额
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            getBalances();
        }
        
        // Ctrl+R 月度报表
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            getMonthlyReport();
        }
    });
    
    // 添加右键菜单（可选）
    document.addEventListener('contextmenu', function(e) {
        // 可以添加自定义右键菜单
    });
    
    // 监听窗口关闭前的警告
    window.addEventListener('beforeunload', function(e) {
        if (STATE.isLoading) {
            e.preventDefault();
            e.returnValue = '正在处理数据，确定要离开吗？';
            return e.returnValue;
        }
    });
    
    // 监听网络状态
    window.addEventListener('online', function() {
        Utils.showResult('🌐 网络已连接', 'success');
    });
    
    window.addEventListener('offline', function() {
        Utils.showResult('🌐 网络已断开，请检查网络连接', 'warning');
    });
    
    // 页面可见性变化时的处理
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // 页面隐藏时暂停某些操作
        } else {
            // 页面显示时恢复操作
        }
    });
    
    console.log('事件监听器已绑定');
    console.log('快捷键: Enter-提交, Esc-清空, Ctrl+H-帮助, Ctrl+B-余额, Ctrl+R-报表');
});

// 错误处理
window.addEventListener('error', function(e) {
    console.error('JavaScript错误:', e.error);
    Utils.showResult(`❌ 页面错误: ${e.error?.message || '未知错误'}`, 'error');
});

// 未捕获的Promise错误
window.addEventListener('unhandledrejection', function(e) {
    console.error('未处理的Promise错误:', e.reason);
    Utils.showResult(`❌ 系统错误: ${e.reason?.message || '未知错误'}`, 'error');
    e.preventDefault();
});

// 导出给全局使用的函数
window.FinancialSystem = {
    submitTransaction,
    getBalances,
    searchTransactions,
    getMonthlyReport,
    validateAccounts,
    fillExample,
    clearResults,
    showHelp,
    exportData
};

console.log('财务记录系统JavaScript模块加载完成');
