#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
解析器调试脚本
用于测试和调试文本解析功能
"""

import sys
import traceback
from modules.parser import TransactionParser
from modules.validator import TransactionValidator

def debug_parse(text):
    """调试解析过程"""
    print(f"=== 调试解析: '{text}' ===")
    
    try:
        # 初始化解析器
        print("1. 初始化解析器...")
        parser = TransactionParser()
        
        # 解析文本
        print("2. 开始解析文本...")
        result = parser.parse(text)
        
        print("3. 解析结果:")
        print(f"   成功: {result['success']}")
        print(f"   消息: {result['message']}")
        
        if result['success']:
            data = result['data']
            print("4. 解析详情:")
            print(f"   动作: {data.get('action')}")
            print(f"   金额: {data.get('amount')}")
            print(f"   描述: {data.get('description')}")
            print(f"   分类: {data.get('category')}")
            print(f"   支付方式: {data.get('payment_method')}")
            print(f"   借方账户: {data.get('debit_account')}")
            print(f"   贷方账户: {data.get('credit_account')}")
            print(f"   置信度: {data.get('confidence')}")
            
            # 验证数据
            print("5. 验证数据...")
            validator = TransactionValidator()
            validation_result = validator.validate_transaction(data)
            
            print(f"   验证通过: {validation_result['valid']}")
            if validation_result['errors']:
                print(f"   错误: {validation_result['errors']}")
            if validation_result['warnings']:
                print(f"   警告: {validation_result['warnings']}")
            if validation_result['suggestions']:
                print(f"   建议: {validation_result['suggestions']}")
        else:
            print("4. 解析失败详情:")
            if 'data' in result and result['data']:
                for key, value in result['data'].items():
                    print(f"   {key}: {value}")
            print(f"   缺失信息: {result.get('missing_info', [])}")
        
        return result
        
    except Exception as e:
        print(f"❌ 发生异常: {type(e).__name__}: {str(e)}")
        print("📍 异常详情:")
        traceback.print_exc()
        return None

def test_step_by_step(text):
    """逐步测试解析过程"""
    print(f"\n=== 逐步测试: '{text}' ===")
    
    try:
        parser = TransactionParser()
        
        # 测试各个解析步骤
        print("1. 测试动作解析...")
        action = parser._parse_action(text)
        print(f"   结果: {action}")
        
        print("2. 测试金额解析...")
        amount = parser._parse_amount(text)
        print(f"   结果: {amount}")
        
        print("3. 测试支付方式解析...")
        payment_method = parser._parse_payment_method(text)
        print(f"   结果: {payment_method}")
        
        print("4. 测试分类解析...")
        category = parser._parse_category(text)
        print(f"   结果: {category}")
        
        print("5. 测试中文数字解析...")
        chinese_amount = parser._parse_chinese_number(text)
        print(f"   结果: {chinese_amount}")
        
    except Exception as e:
        print(f"❌ 步骤测试异常: {type(e).__name__}: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    # 测试问题文本
    test_texts = [
        "吃了吨饭，花了500块",
        "买了咖啡25块用支付宝付的",
        "工资到账8000",
        "花了五百块钱",
        "吃饭花了500元"
    ]
    
    for text in test_texts:
        print("\n" + "="*60)
        debug_parse(text)
        test_step_by_step(text)
        print("="*60)