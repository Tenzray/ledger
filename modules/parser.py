import json
import re
import os
from typing import Dict, List, Optional, Tuple

class TransactionParser:
    def __init__(self):
        self.config_path = "config"
        self.keywords = self._load_config("keywords.json")
        self.categories = self._load_config("categories.json") 
        self.accounts = self._load_config("accounts.json")
        
    def _load_config(self, filename: str) -> dict:
        """加载配置文件"""
        try:
            with open(os.path.join(self.config_path, filename), 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"配置文件 {filename} 未找到")
            return {}
        except json.JSONDecodeError:
            print(f"配置文件 {filename} 格式错误")
            return {}
    
    def parse(self, text: str) -> dict:
        """
        解析用户输入的文本，返回结构化的交易信息
        
        Args:
            text: 用户输入的文本
            
        Returns:
            dict: 包含解析结果的字典
        """
        if not text.strip():
            return self._error_result("输入为空")
        
        try:
            # 预处理文本
            text = self._preprocess_text(text)
            
            # 解析各个组件
            action = self._parse_action(text)
            amount = self._parse_amount(text)
            payment_method = self._parse_payment_method(text)
            category = self._parse_category(text)
            
            # 验证必要信息
            missing_info = []
            if not action:
                missing_info.append("action")
            if not amount:
                missing_info.append("amount")
                
            if missing_info:
                return self._partial_result(text, action, amount, payment_method, category, missing_info)
            
            # 生成会计分录
            accounting_entry = self._generate_accounting_entry(action, amount, payment_method, category)
            
            if not accounting_entry:
                return self._error_result("无法生成有效的会计分录")
            
            # 计算置信度
            confidence = self._calculate_confidence(text, action, amount, payment_method, category)
            
            return {
                'success': True,
                'data': {
                    'action': action,
                    'amount': amount,
                    'description': text,
                    'category': category or "其他费用",
                    'payment_method': payment_method,
                    'debit_account': accounting_entry['debit'],
                    'credit_account': accounting_entry['credit'],
                    'confidence': confidence
                },
                'message': "解析成功",
                'missing_info': []
            }
        except Exception as e:
            return self._error_result(f"解析异常: {str(e)}")
    
    
    def _preprocess_text(self, text: str) -> str:
        """预处理文本"""
        # 转换为小写（英文部分）
        # 去除多余空格
        text = re.sub(r'\s+', ' ', text.strip())
        return text
    
    def _parse_action(self, text: str) -> Optional[str]:
        """解析动作类型"""
        actions = self.keywords.get("actions", {})
        
        for action_type, words_dict in actions.items():
            # 检查中文关键词
            for word in words_dict.get("chinese", []):
                if word in text:
                    return action_type
            # 检查英文关键词
            for word in words_dict.get("english", []):
                if word.lower() in text.lower():
                    return action_type
        
        # 如果没有明确的动作词，根据上下文推测
        if any(word in text for word in ["块", "元", "￥", "$", "yuan", "dollar"]):
            return "expense"  # 默认为支出
            
        return None
    
    def _parse_amount(self, text: str) -> Optional[float]:
        """解析金额"""
        # 正则表达式匹配各种金额格式
        patterns = [
            r'(\d+\.?\d*)\s*[元块￥$]',  # 25元, 25.5块
            r'(\d+\.?\d*)\s*yuan',       # 25 yuan
            r'(\d+\.?\d*)\s*dollar',     # 25 dollar
            r'(\d+\.?\d*)',              # 纯数字（最后尝试）
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                try:
                    return float(matches[0])
                except ValueError:
                    continue
        
        # 尝试解析中文数字
        return self._parse_chinese_number(text)
    
    def _parse_chinese_number(self, text: str) -> Optional[float]:
        """解析中文数字"""
        try:
            chinese_nums = self.keywords.get("amount_patterns", {}).get("number_words", {}).get("chinese", {})
            
            # 简单实现：只处理基本的中文数字
            for chinese, value in chinese_nums.items():
                if chinese in text and str(value) not in text:  # 避免重复匹配
                    # 查找紧跟的单位
                    idx = text.find(chinese)
                    after = text[idx + len(chinese):idx + len(chinese) + 3]  # 增加搜索长度
                    if any(unit in after for unit in ["元", "块", "￥"]):
                        return float(value)
            
            return None
        except Exception as e:
            print(f"中文数字解析异常: {e}")
            return None
    
    def _parse_payment_method(self, text: str) -> Optional[str]:
        """解析支付方式"""
        payment_methods = self.keywords.get("payment_methods", {})
        
        for method_name, aliases_dict in payment_methods.items():
            # 检查中文别名
            for alias in aliases_dict.get("chinese", []):
                if alias in text:
                    return method_name
            # 检查英文别名
            for alias in aliases_dict.get("english", []):
                if alias.lower() in text.lower():
                    return method_name
        
        return None
    
    def _parse_category(self, text: str) -> Optional[str]:
        """解析费用分类"""
        categories = self.categories.get("expense_categories", {})
        
        best_match = None
        max_score = 0
        
        for category_name, config in categories.items():
            score = 0
            
            # 检查关键词匹配
            keywords = config.get("keywords", {})
            for keyword in keywords.get("chinese", []):
                if keyword in text:
                    score += 2
            for keyword in keywords.get("english", []):
                if keyword.lower() in text.lower():
                    score += 2
            
            # 检查商户匹配（权重更高）
            merchants = config.get("merchants", {})
            for merchant in merchants.get("chinese", []):
                if merchant in text:
                    score += 3
            for merchant in merchants.get("english", []):
                if merchant.lower() in text.lower():
                    score += 3
            
            if score > max_score:
                max_score = score
                best_match = category_name
        
        return best_match
    
    def _generate_accounting_entry(self, action: str, amount: float, 
                                 payment_method: str, category: str) -> Optional[dict]:
        """生成会计分录"""
        if action == "expense":
            # 支出：借方是费用账户，贷方是资产账户
            debit = category or "其他费用"
            credit = payment_method or "现金"
            return {"debit": debit, "credit": credit}
            
        elif action == "income":
            # 收入：借方是资产账户，贷方是收入账户
            debit = payment_method or "银行存款"
            credit = category or "其他收入"
            return {"debit": debit, "credit": credit}
            
        elif action == "transfer":
            # 转账：需要解析转出和转入账户
            # 这里简化处理，实际需要更复杂的逻辑
            return {"debit": "待确认", "credit": "待确认"}
        
        return None
    
    def _calculate_confidence(self, text: str, action: str, amount: float, 
                            payment_method: str, category: str) -> float:
        """计算解析置信度"""
        confidence = 0.0
        
        # 基础分数
        if action:
            confidence += 0.3
        if amount:
            confidence += 0.4
        if payment_method:
            confidence += 0.2
        if category:
            confidence += 0.1
            
        return min(confidence, 1.0)
    
    def _error_result(self, message: str) -> dict:
        """返回错误结果"""
        return {
            'success': False,
            'data': None,
            'message': message,
            'missing_info': []
        }
    
    def _partial_result(self, text: str, action: str, amount: float, 
                       payment_method: str, category: str, missing_info: list) -> dict:
        """返回部分解析结果"""
        return {
            'success': False,
            'data': {
                'action': action,
                'amount': amount,
                'payment_method': payment_method,
                'category': category,
                'description': text
            },
            'message': f"缺少信息: {', '.join(missing_info)}",
            'missing_info': missing_info
        }


# 简单测试代码
if __name__ == "__main__":
    parser = TransactionParser()
    
    # 测试用例
    test_cases = [
        "买了咖啡25块用支付宝付的",
        "工资到账8000",
        "bought coffee 25 yuan with alipay",
        "花了五十块钱",
    ]
    
    for case in test_cases:
        print(f"\n输入: {case}")
        result = parser.parse(case)
        print(f"结果: {result}")