# scripts/bteb_data_builder.py
"""
Script to build accurate BTEB Polytechnic Data for Polytechnic Notice AI.
Focuses strictly on official verified BTEB general policies, quotas, eligibility rules, and official links.
Removes static hardcoded seat numbers so AI dynamically searches live sources.
"""

import json

bteb_data = {
    "summary": "বাংলাদেশ কারিগরি শিক্ষা বোর্ড (BTEB) এর অধীনস্থ সরকারি ও বেসরকারি পলিটেকনিক ইনস্টিটিউট ভর্তি সংক্রান্ত অফিশিয়াল নীতি ও নিয়মাবলী।",
    "institutes": {
        "government_count": "৪৯টি সরকারি পলিটেকনিক ইনস্টিটিউট + ৩টি বিশেষায়িত ইনস্টিটিউট (গ্রাফিক্স আর্টস ইনস্টিটিউট, গ্লাস এন্ড সিরামিক ইনস্টিটিউট, বাংলাদেশ সার্ভে ইনস্টিটিউট) = মোট ৫২টি সরকারি প্রতিষ্ঠান।",
        "private_count": "দেশজুড়ে ৪০০টিরও বেশি অনুমোদিত বেসরকারি পলিটেকনিক ইনস্টিটিউট রয়েছে।",
        "shifts": "সরকারি পলিটেকনিকে ২টি শিফটে (১ম শিফট ও ২য় শিফট) পাঠদান করা হয়।"
    },
    "eligibility": {
        "government": {
            "boys": "এসএসসি (SSC) / সমমান পরীক্ষায় ন্যূনতম জিপিএ ৩.৫০ (সাধারণ গণিত বা উচ্চতর গণিতে ন্যূনতম ৩.০০ পেতে হবে)। পাশের সাল হতে হবে কারিগরি শিক্ষা বোর্ডের সার্কুলার অনুযায়ী সাম্প্রতিক শিক্ষাবর্ষ।",
            "girls": "এসএসসি (SSC) / সমমান পরীক্ষায় ন্যূনতম জিপিএ ৩.০০ (সাধারণ গণিত বা উচ্চতর গণিতে ন্যূনতম ৩.০০ পেতে হবে)। পাশের সাল হতে হবে সাম্প্রতিক শিক্ষাবর্ষ।",
            "vocational": "এসএসসি (ভোকেশনাল) থেকে আগত শিক্ষার্থীরা যেকোনো শিফটে বিশেষ অগ্রাধিকার (১৫% কোটা) পাবেন।"
        },
        "private": "এসএসসি বা সমমান পরীক্ষায় যেকোনো সালের পাসে ন্যূনতম জিপিএ ২.০০ থাকলেই সরাসরি আবেদন ও ভর্তি হওয়া যায়।"
    },
    "quotas": [
        {"name": "মহিলা কোটা (Female Quota)", "percentage": "২০%", "description": "সরকারি পলিটেকনিকে ছাত্রীদের ভর্তির সুযোগ বাড়াতে নির্ধারিত।"},
        {"name": "এসএসসি ভোকেশনাল কোটা (SSC Vocational)", "percentage": "১৫%", "description": "কারিগরি শিক্ষা বোর্ডের অধীনে ভোকেশনাল থেকে আসা শিক্ষার্থীদের জন্য।"},
        {"name": "মুক্তিযোদ্ধা কোটা (Freedom Fighter)", "percentage": "৫%", "description": "বীর মুক্তিযোদ্ধাদের সন্তান (সন্তানের সন্তান নয়)দের জন্য।"},
        {"name": "প্রতিবন্ধী কোটা (Disabled Quota)", "percentage": "১%", "description": "বিশেষ চাহিদাসম্পন্ন শিক্ষার্থীদের জন্য।"},
        {"name": "ক্ষুদ্র নৃগোষ্ঠী কোটা (Minority/Ethnic)", "percentage": "১%", "description": "পার্বত্য ও দেশের অন্যান্য উপজাতি/ক্ষুদ্র নৃগোষ্ঠীর জন্য।"},
        {"name": "কারিগরি শিক্ষা বোর্ড ও মন্ত্রণালয় কোটা", "percentage": "২%", "description": "বোর্ড ও মন্ত্রণালয়ের কর্মকর্তাদের সন্তানদের জন্য।"}
    ],
    "admissionProcess": {
        "portal": "btebadmission.gov.bd",
        "official_site": "bteb.gov.bd",
        "fee": {
            "single_shift": "১৬২ টাকা",
            "both_shifts": "৩২৪ টাকা",
            "payment_methods": "বিকাশ, রকেট, নগদ, উপায়"
        },
        "confirmation_fee": "২৩৮ টাকা (মেধাতালিকায় স্থান পাওয়ার পর নির্দিষ্ট সময়ে নিশ্চায়ন পেমент করতে হয়)",
        "choice_list_rules": "একজন আবেদনকারী সর্বোচ্চ ১০টি প্রতিষ্ঠান ও টেকনোলজি পছন্দক্রম (Choice List) হিসেবে সাজাতে পারবেন।",
        "selection_method": "কোনো ভর্তি পরীক্ষা নেওয়া হয় না। সম্পূর্ণ SSC / সমমান পরীক্ষার জিপিএ এবং সাধারণ গণিত/উচ্চতর গণিত ও বিজ্ঞানের নম্বরের ওপর নির্ভর করে কম্পিউটার সিস্টেমের মাধ্যমে মেধাতালিকা প্রস্তুত করা হয়।"
    }
}

js_content = f"// lib/btebData.js\n// বাংলাদেশ কারিগরি শিক্ষা বোর্ড (BTEB) অফিশিয়াল নীতি ডাটাবেস\n\nconst BTEB_DATA = {json.dumps(bteb_data, ensure_ascii=False, indent=2)};\n\nexport default BTEB_DATA;\n"

with open("lib/btebData.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("lib/btebData.js cleaned and updated successfully!")
