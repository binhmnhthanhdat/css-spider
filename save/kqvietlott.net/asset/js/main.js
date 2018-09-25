function str_pad(number) {
    if (number < 10) {
        return '0' + number;
    } 
    return number;
}

function showDay(date){ 
    var day = date.getDay(); 
    return [jQuery.inArray(day+1, [4,6,1]) !== -1,'']
}; 
        
function getSuccessOutput(day) {
    var round = $('input[name=round]').val() + 10;

    $.ajax({
        url: "http://vietlott.vn/Ajax/PrevNextResultGameMega645",
        method: "post",
        data: { gameId: 3, drawId: round, dayPrize: day, type: 0 },
        success: function(result) {
            if (result !== "") {
                $('#output').html(result);
            }
        },
        error: function(e) {
           console.log(e);
        }
    });
}

$( function() {
    // $.datepicker.setDefaults( $.datepicker.regional[ "vi" ] );
    $("#mega645").datepicker({
    	beforeShowDay: showDay,
    	showOn: "button",
       	buttonImage: "/images/calendar.png",
        buttonImageOnly: true,
    	changeYear: true, 
        showButtonPanel: true, 
        regional: 'vn', 
        onSelect:  function(date) {
    		split = date.split("/");
    		d = parseInt(split[0]);
    		// var day = split[1] + '/' + d + '/' + split[2];
    		// getSuccessOutput(day);
            var day = d + '-' + split[1] + '-' + split[2];
            document.location = '/ket-qua-so-xo-vietlott-mega-6-45/' + day;
    	},
    	dateFormat: 'dd/mm/yy', 
        maxDate: +0,
        changeMonth: true,
        // selectOtherMonths: true,
    });



    if (isTimeLiveMega645) {
        setInterval(function() {
            $.get('/live645', function (data) {
                if (data.result != null) {
                    if (data.result.no1 != null) {
                        $('.live645_no1').html(str_pad(data.result.no1));
                    }
                    if (data.result.no2 != null) {
                        $('.live645_no2').html(str_pad(data.result.no2));
                    }
                    if (data.result.no3 != null) {
                        $('.live645_no3').html(str_pad(data.result.no3));
                    }
                    if (data.result.no4 != null) {
                        $('.live645_no4').html(str_pad(data.result.no4));
                    }
                    if (data.result.no5 != null) {
                        $('.live645_no5').html(str_pad(data.result.no5));
                    }
                    if (data.result.no6 != null) {
                        $('.live645_no6').html(str_pad(data.result.no6));
                    }
                }
            });
        }, 3000);
    }
});




