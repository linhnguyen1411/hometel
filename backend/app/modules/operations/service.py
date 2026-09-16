from typing import Dict, Any, List, Optional
from datetime import datetime

from .schemas import AiTriageResponse


class OperationsService:
    @staticmethod
    def ai_triage(description: str, category_hint: Optional[str] = None) -> AiTriageResponse:
        text = f"{description} {category_hint or ''}".lower()

        category = "OTHER"
        urgency = "MEDIUM"
        possible_issues: List[str] = []
        suggested_checks: List[str] = []

        if any(w in text for w in ["máy lạnh", "điều hòa", "ac", "lạnh", "chảy nước"]):
            category = "HVAC"
            urgency = "HIGH" if ("chảy nước" in text or "bốc mùi" in text) else "MEDIUM"
            possible_issues = [
                "Nghẹt đường ống xả thoát nước ngưng",
                "Lưới lọc bụi bẩn làm giảm lưu lượng gió đối lưu",
                "Thiếu môi chất lạnh (Ga R32/R410A) hoặc rò rỉ khớp nối",
            ]
            suggested_checks = [
                "Vệ sinh tấm lọc gió dàn lạnh",
                "Thông ống thoát nước ngưng bằng khí nén",
                "Đo áp suất ga hút và kiểm tra rò rỉ bọt xà phòng",
            ]
        elif any(w in text for w in ["nước", "vòi", "nghẹt", "rò rỉ", "bồn cầu", "lavabo"]):
            category = "PLUMBING"
            urgency = "EMERGENCY" if ("ngập" in text or "vỡ" in text) else "HIGH"
            possible_issues = [
                "Rò rỉ gioăng cao su khớp nối van cấp",
                "Tắc nghẽn bẫy chữ P (P-trap) do tóc hoặc cặn bã",
                "Hỏng phao cấp xả bồn cầu gây tràn liên tục",
            ]
            suggested_checks = [
                "Khóa van chặn nhánh khẩn cấp",
                "Tháo vệ sinh bẫy chữ P dưới bồn rửa",
                "Kiểm tra áp lực đường cấp chính",
            ]
        elif any(w in text for w in ["điện", "chập", "sập aptomat", "nhấp nháy", "ổ cắm"]):
            category = "ELECTRICAL"
            urgency = "EMERGENCY" if any(w in text for w in ["cháy", "chập", "khét"]) else "HIGH"
            possible_issues = [
                "Quá tải tức thời làm nhảy aptomat nhánh",
                "Lỏng ốc siết cọc tiếp xúc trong đế âm tường",
                "Chập vi mạch nguồn LED driver đèn trần",
            ]
            suggested_checks = [
                "Dùng bút thử điện kiểm tra rò vỏ thiết bị",
                "Kiểm tra thông mạch CB chống giật RCBO",
                "Đo điện áp tải lúc bật thiết bị công suất lớn",
            ]
        elif any(w in text for w in ["dọn", "vệ sinh", "bẩn", "sofa", "nệm"]):
            category = "CLEANING"
            urgency = "LOW"
            possible_issues = ["Cần phun khử khuẩn và giặt sâu hơi nước nóng"]
            suggested_checks = ["Đánh giá chất liệu vải nỉ/da", "Chọn dung dịch trung tính an toàn diệt khuẩn"]
        elif any(w in text for w in ["khóa", "mật khẩu", "kẹt cửa", "hết pin"]):
            category = "SECURITY"
            urgency = "HIGH"
            possible_issues = ["Pin khóa thông minh dưới 10%", "Kẹt lẫy chốt cơ học"]
            suggested_checks = ["Kích nguồn khẩn cấp qua cổng Type-C/9V", "Kiểm tra độ rơ của khe hở đố cửa"]

        return AiTriageResponse(
            category=category,
            urgency=urgency,
            possibleIssues=possible_issues,
            suggestedChecks=suggested_checks,
            recommendedService={
                "name": f"Dịch vụ kỹ thuật chuyên khoa {category}",
                "providerName": "Đội Kỹ Thuật Cơ Điện Homtel 24/7",
                "hotline": "1900 6868",
                "slaMinutes": 30 if urgency == "EMERGENCY" else 120,
            },
        )
